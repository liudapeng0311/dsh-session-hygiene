/**
 * dsh-session-hygiene — host half.
 *
 * Two gaps this closes, both of which the shipped sidebar leaves open:
 *
 *   1. A session can be archived but never deleted, so a workspace you stop
 *      using keeps every conversation it ever held.
 *   2. `workspaceRegistry.delete()` removes the registration only. The
 *      sessions stay in `<home>/sessions/<group>/<id>/`, their `header.cwd` no
 *      longer matches any workspace, and the sidebar has nowhere to show them.
 *      They are effectively unreachable orphans.
 *
 * Both are handled here, over one authenticated route:
 *
 *   POST /api/session-hygiene   { "action": "...", ... }
 *
 *     scan     → stored sessions annotated with their workspace, plus the trash
 *     trash    → stop work, detach, move the log into the trash (recoverable)
 *     restore  → move a trashed session back to where it came from
 *     purge    → delete one trash entry for good
 *     archive  → archive a batch of sessions through the shipped registry
 *
 * Deleting never unlinks the log: it is renamed into
 * `<home>/storages/session-hygiene/trash/<sessionId>__<stamp>/`, next to an
 * `entry.json` describing where it came from. `purge` is the only destructive
 * operation and it always carries an explicit entry id.
 */
import { promises as fsp } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ROUTE = '/api/session-hygiene';
const ACTION_HEADER = 'x-dsh-session-hygiene';
const BODY_LIMIT = 256 * 1024;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@~-]{0,199}$/;
const SAFE_ENTRY = /^[A-Za-z0-9][A-Za-z0-9._:@~-]{0,240}$/;

const json = (status, value) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const fail = (status, message) => json(status, { ok: false, message });

const textOf = (error) => (error instanceof Error ? error.message : String(error));

const warn = (...args) => {
  try {
    console.warn('[session-hygiene]', ...args);
  } catch {
    /* console may already be gone */
  }
};

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* environment                                                         */
/* ------------------------------------------------------------------ */

function dshHome() {
  const fromEnv = process.env.DSH_HOME;
  return typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : path.join(homedir(), '.dsh');
}

const sessionsRoot = () => path.join(dshHome(), 'sessions');
const cacheRoot = () => path.join(dshHome(), 'storages', 'session_projcache', 'sessions');
const trashRoot = () => path.join(dshHome(), 'storages', 'session-hygiene', 'trash');

/** Category bookkeeping lives beside the trash, never inside the workspace registry. */
const categoriesPath = () => path.join(dshHome(), 'storages', 'session-hygiene', 'categories.json');

const cleanCategoryName = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 40) : '';

const cleanCategoryId = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : '';

async function readCategories() {
  try {
    const parsed = JSON.parse(await fsp.readFile(categoriesPath(), 'utf8'));
    const categories = [];
    const seen = new Set();
    for (const entry of Array.isArray(parsed?.categories) ? parsed.categories : []) {
      const id = cleanCategoryId(entry?.id);
      const name = cleanCategoryName(entry?.name);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      categories.push({ id, name });
    }
    const assignments = {};
    const known = new Set(categories.map((category) => category.id));
    for (const [workspaceId, categoryId] of Object.entries(parsed?.assignments ?? {})) {
      if (typeof workspaceId !== 'string' || !known.has(categoryId)) continue;
      assignments[workspaceId] = categoryId;
    }
    const collapsed = {};
    for (const [categoryId, value] of Object.entries(parsed?.collapsed ?? {})) {
      if (known.has(categoryId) && value === true) collapsed[categoryId] = true;
    }
    return { categories, assignments, collapsed, showHeaders: parsed?.showHeaders !== false };
  } catch {
    return { categories: [], assignments: {}, collapsed: {}, showHeaders: true };
  }
}

async function writeCategories(state) {
  const file = categoriesPath();
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(state, null, 2), 'utf8');
}

/** Resolve an optional host service without hard-failing when it is absent. */
function service(ctx, name) {
  try {
    const found = ctx.get?.(name);
    if (found) return found;
  } catch {
    /* optional access */
  }
  try {
    return ctx[name];
  } catch {
    return undefined;
  }
}

const isDirectory = async (candidate) => {
  try {
    return (await fsp.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
};

const exists = async (candidate) => {
  try {
    await fsp.stat(candidate);
    return true;
  } catch {
    return false;
  }
};

/** Stable comparison key for a directory path. */
function norm(target) {
  if (typeof target !== 'string' || target.length === 0) return '';
  let value = path.resolve(target);
  while (value.length > 3 && (value.endsWith(path.sep) || value.endsWith('/'))) {
    value = value.slice(0, -1);
  }
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

/** Workspace records carry the directory under one of these names. */
function workspacePath(workspace) {
  if (!workspace || typeof workspace !== 'object') return '';
  for (const key of ['path', 'directory', 'cwd', 'dir', 'root']) {
    const value = workspace[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

/** The projection cache keys a session by its id with the `session-` prefix gone. */
const cacheKey = (sessionId) => sessionId.replace(/^session-/, '');

/** Collapse whitespace and bound the length of a cache string. */
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return '';
  return flat.length > max ? flat.slice(0, max) + '…' : flat;
}

/* ------------------------------------------------------------------ */
/* reading state                                                       */
/* ------------------------------------------------------------------ */

/**
 * Titles and opening prompts live in the projection cache: `rows.title.val` and
 * `rows.titleInput.val.first.text`. Reading them costs one small JSON per
 * session and avoids decompressing a session log just to label a row.
 */
async function readCacheInfo(needed) {
  const info = new Map();
  let names = [];
  try {
    names = await fsp.readdir(cacheRoot());
  } catch {
    return info;
  }
  await Promise.all(
    names.map(async (name) => {
      if (!name.endsWith('.json')) return;
      const key = name.slice(0, -'.json'.length);
      if (needed && !needed.has(key) && !needed.has(`session-${key}`)) return;
      try {
        const raw = await fsp.readFile(path.join(cacheRoot(), name), 'utf8');
        const rows = JSON.parse(raw)?.record?.rows;
        const title = rows?.title?.val;
        const first = rows?.titleInput?.val?.first?.text;
        info.set(key, {
          title: cleanText(title, 200),
          preview: cleanText(first, 280),
        });
      } catch {
        /* a broken cache entry is not worth failing the scan over */
      }
    }),
  );
  return info;
}

/**
 * Fallback for sessions the projection cache never checkpointed: open the log
 * read-only and take the first user message. `read(offset, length)` is
 * (logical seq, event count), so this reads a bounded head instead of the whole
 * log. Read access takes no ownership and is closed immediately.
 */
async function readOpening(persistence, sessionId) {
  if (!persistence || typeof persistence.open !== 'function') return '';
  let handle;
  try {
    handle = await persistence.open(sessionId, 'read');
    const slice = await handle.read(0, 40);
    for (const event of slice?.events ?? []) {
      if (event?.type !== 'user/message') continue;
      const content = event?.data?.content;
      if (!Array.isArray(content)) continue;
      const text = content
        .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join(' ');
      const cleaned = cleanText(text, 280);
      if (cleaned) return cleaned;
    }
    return '';
  } catch (error) {
    warn('readOpening failed', sessionId, textOf(error));
    return '';
  } finally {
    try {
      await handle?.close?.();
    } catch {
      /* closing a read handle cannot fail meaningfully */
    }
  }
}

async function listTrash() {
  const root = trashRoot();
  let names = [];
  try {
    names = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const entries = [];
  for (const name of names) {
    if (!name.isDirectory()) continue;
    const dir = path.join(root, name.name);
    try {
      const raw = await fsp.readFile(path.join(dir, 'entry.json'), 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.sessionId === 'string') {
        entries.push({
          id: name.name,
          sessionId: parsed.sessionId,
          title: typeof parsed.title === 'string' ? parsed.title : '',
          preview: typeof parsed.preview === 'string' ? parsed.preview : '',
          cwd: typeof parsed.cwd === 'string' ? parsed.cwd : '',
          from: typeof parsed.from === 'string' ? parsed.from : '',
          sizeBytes: typeof parsed.sizeBytes === 'number' ? parsed.sizeBytes : 0,
          deletedAt: typeof parsed.deletedAt === 'number' ? parsed.deletedAt : 0,
        });
      }
    } catch {
      /* an entry without a manifest is not a trash entry we can restore */
    }
  }
  entries.sort((a, b) => b.deletedAt - a.deletedAt);
  return entries;
}

/**
 * Every directory that may hold this session. The persistence snapshot's
 * `location.path` is authoritative when the backend reports one; the directory
 * scan is the fallback for backends that do not.
 */
async function resolveSessionDirs(ctx, sessionId) {
  const found = new Set();
  const persistence = service(ctx, 'sessionPersistence');
  if (persistence && typeof persistence.stat === 'function') {
    try {
      const snapshot = await persistence.stat(sessionId);
      const located = snapshot?.location?.path;
      if (typeof located === 'string' && located.length > 0) {
        if (await isDirectory(located)) found.add(located);
        else if (await exists(located)) found.add(path.dirname(located));
      }
    } catch (error) {
      warn('stat failed', sessionId, textOf(error));
    }
  }
  let groups = [];
  try {
    groups = await fsp.readdir(sessionsRoot(), { withFileTypes: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  for (const group of groups) {
    if (!group.isDirectory()) continue;
    for (const candidateId of new Set([sessionId, encodeSegment(sessionId)])) {
      const candidate = path.join(sessionsRoot(), group.name, candidateId);
      if (await isDirectory(candidate)) found.add(candidate);
    }
  }
  return [...found];
}

/** One safe path segment, mirroring the jsonl backend's escape. */
function encodeSegment(raw) {
  if (raw.length === 0) return '';
  if (raw === '.') return '~002E';
  if (raw === '..') return '~002E~002E';
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    const ch = String.fromCharCode(code);
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
    else out += '~' + code.toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}

/** Recursive byte total, so the panel can show what a session costs. */
async function measureDir(dir) {
  let total = 0;
  let stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(child);
      else {
        try {
          total += (await fsp.stat(child)).size;
        } catch {
          /* raced with a writer; not fatal */
        }
      }
    }
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* mutations                                                           */
/* ------------------------------------------------------------------ */

/** Drop the id from every workspace, and from the pinned list. */
async function detachFromWorkspaces(ctx, sessionId) {
  const registry = service(ctx, 'workspaceRegistry');
  let detached = 0;
  if (registry && typeof registry.list === 'function') {
    for (const workspace of registry.list()) {
      const ids = workspace?.sessionIds;
      if (!Array.isArray(ids) || !ids.includes(sessionId)) continue;
      try {
        await workspace.detachSession(sessionId);
        detached += 1;
      } catch (error) {
        warn('detachSession failed', textOf(error));
      }
    }
  }
  try {
    await registry?.unpinSession?.(sessionId);
  } catch {
    /* not pinned */
  }
  return detached;
}

/** Archive through the shipped registry: this both stops work and hides the row. */
async function hideSession(ctx, sessionId) {
  const registry = service(ctx, 'workspaceRegistry');
  if (!registry || typeof registry.archiveSession !== 'function') return false;
  try {
    await registry.archiveSession(sessionId, { stopActivity: true });
    return true;
  } catch (error) {
    warn('archiveSession failed', sessionId, textOf(error));
    return false;
  }
}

/**
 * Trashing archives the session to hide its row, so a restore has to undo that
 * archive as well. Without it the log returns to its origin, the workspace
 * lists the id again, and the sidebar still hides the row.
 */
async function unhideSession(ctx, sessionId) {
  const registry = service(ctx, 'workspaceRegistry');
  if (!registry || typeof registry.unarchiveSession !== 'function') return false;
  try {
    await registry.unarchiveSession(sessionId);
    return true;
  } catch (error) {
    warn('unarchiveSession failed', sessionId, textOf(error));
    return false;
  }
}

/** Page-wide row removal without a reload (forwarded host event). */
function announceRemoval(ctx, sessionId) {
  try {
    if (typeof ctx.emit !== 'function') return false;
    ctx.emit('api-session/removed', sessionId);
    return true;
  } catch (error) {
    warn('announceRemoval failed', textOf(error));
    return false;
  }
}

async function dropCacheEntry(sessionId) {
  const key = cacheKey(sessionId);
  for (const name of new Set([`${key}.json`, `${sessionId}.json`])) {
    try {
      await fsp.rm(path.join(cacheRoot(), name), { force: true });
    } catch {
      /* a stale cache entry is harmless */
    }
  }
}

async function doTrash(ctx, sessionId) {
  if (!SAFE_ID.test(sessionId) || sessionId.includes('..')) throw new RequestError(400, '无效的会话 ID');
  const dirs = await resolveSessionDirs(ctx, sessionId);
  if (dirs.length === 0) {
    throw new RequestError(404, '没有找到这个会话的存储文件（可能已经被删除了）。');
  }
  const persistence = service(ctx, 'sessionPersistence');
  let cwd = '';
  let createdAt = 0;
  try {
    const snapshot = await persistence?.stat?.(sessionId);
    if (typeof snapshot?.header?.cwd === 'string') cwd = snapshot.header.cwd;
    if (typeof snapshot?.header?.createdAt === 'number') createdAt = snapshot.header.createdAt;
  } catch {
    /* header is best-effort */
  }
  const cached = (await readCacheInfo(new Set([sessionId]))).get(cacheKey(sessionId)) || {};
  const title = cached.title || '';
  // The trash entry keeps a readable label even for a session the projection
  // cache never checkpointed.
  const preview = cached.preview || (await readOpening(persistence, sessionId)) || '';

  const hidden = await hideSession(ctx, sessionId);
  const detached = await detachFromWorkspaces(ctx, sessionId);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const entryId = `${sessionId}__${stamp}`;
  const target = path.join(trashRoot(), entryId);
  const sizeBytes = await measureDir(dirs[0]);

  await fsp.mkdir(path.dirname(target), { recursive: true });
  try {
    await fsp.rename(dirs[0], target);
  } catch (error) {
    const busy = ['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(error?.code);
    if (hidden) await service(ctx, 'workspaceRegistry')?.unarchiveSession?.(sessionId).catch(() => {});
    throw new RequestError(
      409,
      busy
        ? '会话数据仍被占用。先切到另一个对话，再回来删除。'
        : '移动会话数据失败：' + textOf(error),
    );
  }
  for (const extra of dirs.slice(1)) {
    try {
      await fsp.rm(extra, { recursive: true, force: true });
    } catch {
      /* duplicate copies are leftovers */
    }
  }
  // The projection cache is deliberately left in place: it is a derived
  // artifact, and keeping it means a restored session still shows its title and
  // opening prompt instead of falling back to a bare id. Purge removes it.
  await fsp.writeFile(
    path.join(target, 'entry.json'),
    JSON.stringify(
      { sessionId, cwd, from: dirs[0], title, preview, createdAt, sizeBytes, deletedAt: Date.now() },
      null,
      2,
    ),
    'utf8',
  );

  const announced = announceRemoval(ctx, sessionId);
  return {
    ok: true,
    sessionId,
    entryId,
    hidden,
    detached,
    announced,
    sizeBytes,
    title,
  };
}

/**
 * Bulk trash: one request for the whole orphan list instead of N round trips.
 * Each entry goes through the exact single-session path, and a failure is
 * reported per session rather than aborting the rest.
 */
async function doTrashMany(ctx, sessionIds) {
  const trashed = [];
  const failed = [];
  for (const sessionId of sessionIds) {
    if (typeof sessionId !== 'string' || !SAFE_ID.test(sessionId)) continue;
    try {
      const result = await doTrash(ctx, sessionId);
      trashed.push(result.sessionId);
    } catch (error) {
      failed.push({ sessionId, message: textOf(error) });
    }
  }
  return { ok: failed.length === 0, trashed: trashed.length, failed };
}

/**
 * `api-session/added` carries a SessionSummary, never a bare id: an id alone
 * makes the client upsert a row with no `updatedAt` (rendered as "NaN年") and no
 * title projection. Build every field the receiver expects.
 */
async function sessionSummary(ctx, sessionId) {
  const persistence = service(ctx, 'sessionPersistence');
  let header;
  let eventCount = 0;
  let updatedAt = 0;
  try {
    const snapshot = await persistence?.stat?.(sessionId);
    header = snapshot?.header;
    eventCount = typeof snapshot?.eventCount === 'number' ? snapshot.eventCount : 0;
    if (typeof header?.createdAt === 'number') updatedAt = header.createdAt;
    if (eventCount > 0 && typeof persistence?.open === 'function') {
      const handle = await persistence.open(sessionId, 'read');
      try {
        // Last logical seq, so the row sorts and labels like a normal session.
        const slice = await handle.read(eventCount - 1, 1);
        const last = slice?.events?.[slice.events.length - 1];
        if (last && typeof last.time === 'number') updatedAt = last.time;
      } finally {
        try {
          await handle?.close?.();
        } catch {
          /* read handle */
        }
      }
    }
  } catch (error) {
    warn('sessionSummary failed', sessionId, textOf(error));
  }

  let agentAvailable = false;
  try {
    agentAvailable = Boolean(service(ctx, 'agents')?.get?.(sessionId));
  } catch {
    /* optional service */
  }

  const summary = {
    sessionId,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
    running: false,
    blank: eventCount === 0,
    agentAvailable,
  };
  if (typeof header?.cwd === 'string' && header.cwd.length > 0) summary.cwd = header.cwd;
  if (header?.origin === 'subagent') summary.origin = 'subagent';
  if (typeof header?.parentSession === 'string') summary.parentSessionId = header.parentSession;
  return summary;
}

/** Put a restored session back under the workspace its cwd belongs to. */
async function attachByCwd(ctx, sessionId, cwd) {
  const registry = service(ctx, 'workspaceRegistry');
  if (!registry || typeof registry.resolveByPath !== 'function') return false;
  if (typeof cwd !== 'string' || cwd.length === 0) return false;
  try {
    const workspace = await registry.resolveByPath(cwd);
    if (!workspace || typeof workspace.attachSession !== 'function') return false;
    await workspace.attachSession(sessionId);
    return true;
  } catch (error) {
    warn('attachSession failed', sessionId, textOf(error));
    return false;
  }
}

async function doRestore(ctx, entryId) {
  if (typeof entryId !== 'string' || !SAFE_ENTRY.test(entryId) || entryId.includes('..')) {
    throw new RequestError(400, '无效的回收站条目');
  }
  const dir = path.join(trashRoot(), entryId);
  let entry;
  try {
    entry = JSON.parse(await fsp.readFile(path.join(dir, 'entry.json'), 'utf8'));
  } catch {
    throw new RequestError(404, '回收站里没有这个条目。');
  }
  if (typeof entry.from !== 'string' || entry.from.length === 0) {
    throw new RequestError(400, '这个条目没有记录原始位置，无法恢复。');
  }
  if (await exists(entry.from)) {
    throw new RequestError(409, '原位置已有同名会话，未覆盖。可先移动或删除它再恢复。');
  }
  await fsp.mkdir(path.dirname(entry.from), { recursive: true });
  try {
    await fsp.rename(dir, entry.from);
  } catch (error) {
    throw new RequestError(500, '恢复失败：' + textOf(error));
  }
  // Trashing archived the row and detached the id from its workspace; a restore
  // must undo both, or the session comes back invisible or ungrouped.
  const unarchived = await unhideSession(ctx, entry.sessionId);
  const attached = await attachByCwd(ctx, entry.sessionId, entry.cwd);
  try {
    if (typeof ctx.emit === 'function') {
      ctx.emit('api-session/added', await sessionSummary(ctx, entry.sessionId));
    }
  } catch (error) {
    warn('announceAdd failed', textOf(error));
  }
  return { ok: true, sessionId: entry.sessionId, restoredTo: entry.from, attached, unarchived };
}

async function doPurge(ctx, entryId) {
  if (typeof entryId !== 'string' || !SAFE_ENTRY.test(entryId) || entryId.includes('..')) {
    throw new RequestError(400, '无效的回收站条目');
  }
  const dir = path.join(trashRoot(), entryId);
  if (!(await isDirectory(dir))) throw new RequestError(404, '回收站里没有这个条目。');
  let sessionId = '';
  try {
    const entry = JSON.parse(await fsp.readFile(path.join(dir, 'entry.json'), 'utf8'));
    if (typeof entry?.sessionId === 'string') sessionId = entry.sessionId;
  } catch {
    /* an entry without a manifest still gets removed */
  }
  await fsp.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
  // Nothing can restore this session any more, so its cache entry goes too.
  if (sessionId) await dropCacheEntry(sessionId);
  return { ok: true, entryId };
}

/** Bulk restore / bulk purge: one request each, per-entry failures collected. */
async function doRestoreMany(ctx, entryIds) {
  const restored = [];
  const failed = [];
  for (const entryId of entryIds) {
    if (typeof entryId !== 'string') continue;
    try {
      await doRestore(ctx, entryId);
      restored.push(entryId);
    } catch (error) {
      failed.push({ entryId, message: textOf(error) });
    }
  }
  return { ok: failed.length === 0, restored: restored.length, failed };
}

async function doPurgeMany(ctx, entryIds) {
  const purged = [];
  const failed = [];
  for (const entryId of entryIds) {
    if (typeof entryId !== 'string') continue;
    try {
      await doPurge(ctx, entryId);
      purged.push(entryId);
    } catch (error) {
      failed.push({ entryId, message: textOf(error) });
    }
  }
  return { ok: failed.length === 0, purged: purged.length, failed };
}

/** Workspaces annotated with the category they belong to, plus the category list. */
async function doCategories(ctx) {
  const registry = service(ctx, 'workspaceRegistry');
  const workspaces = registry && typeof registry.list === 'function' ? registry.list() : [];
  const state = await readCategories();
  return {
    ok: true,
    categories: state.categories,
    assignments: state.assignments,
    collapsed: state.collapsed ?? {},
    showHeaders: state.showHeaders !== false,
    workspaces: workspaces.map((workspace) => {
      const id = String(workspace?.id ?? '');
      return {
        id,
        title: String(workspace?.title ?? ''),
        path: workspacePath(workspace),
        categoryId: state.assignments[id] ?? null,
      };
    }),
  };
}

/**
 * Reorder so same-category workspaces are contiguous, keeping each category's
 * internal order. Chaining `insertBefore(previous, next)` from the tail
 * backwards places every predecessor directly before its successor, so the
 * result is exact — and it never relies on the optional `beforeId` meaning
 * "append", which the registry does not promise to clients.
 *
 * The pass is verified and repeated: a drag's own `insertBefore` is a Remote
 * call that can land in the middle of this chain and leave the order one step
 * off, which then splits two categories and hides their headers. Re-reading and
 * re-applying until the order holds absorbs that race.
 */
async function applyClusters(ctx, state) {
  const registry = service(ctx, 'workspaceRegistry');
  if (
    !registry ||
    typeof registry.list !== 'function' ||
    typeof registry.insertBefore !== 'function'
  ) {
    throw new RequestError(501, '当前 profile 没有 workspaceRegistry，无法调整顺序。');
  }

  const rank = new Map(state.categories.map((category, index) => [category.id, index]));
  const sortList = (list) =>
    list
      .map((workspace, index) => ({ workspace, index }))
      .sort((a, b) => {
        const idA = String(a.workspace?.id ?? '');
        const idB = String(b.workspace?.id ?? '');
        const rankA = rank.has(state.assignments[idA])
          ? rank.get(state.assignments[idA])
          : Number.MAX_SAFE_INTEGER;
        const rankB = rank.has(state.assignments[idB])
          ? rank.get(state.assignments[idB])
          : Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.index - b.index;
      })
      .map((entry) => entry.workspace);

  for (let pass = 0; pass < 4; pass += 1) {
    const current = registry.list();
    const ordered = sortList(current);
    const currentIds = current.map((workspace) => String(workspace?.id ?? ''));
    const targetIds = ordered.map((workspace) => String(workspace?.id ?? ''));
    // Already grouped: no writes at all. `insertBefore` persists the registry on
    // every call, so a no-op pass over 20 workspaces would be 19 writes.
    if (currentIds.every((id, index) => id === targetIds[index])) return targetIds;

    for (let i = ordered.length - 1; i >= 1; i -= 1) {
      const previous = ordered[i - 1];
      const next = ordered[i];
      if (String(previous?.id) === String(next?.id)) continue;
      await registry.insertBefore(previous.id, next.id);
    }
  }
  return registry.list().map((workspace) => String(workspace?.id ?? ''));
}

async function doSaveCategories(ctx, body) {
  const incoming = Array.isArray(body?.categories) ? body.categories.slice(0, 40) : [];
  const categories = [];
  const seen = new Set();
  for (const entry of incoming) {
    const name = cleanCategoryName(entry?.name);
    if (!name) continue;
    let id = cleanCategoryId(entry?.id);
    if (!id || seen.has(id)) {
      id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    categories.push({ id, name });
  }

  const known = new Set(categories.map((category) => category.id));
  const assignments = {};
  for (const [workspaceId, categoryId] of Object.entries(body?.assignments ?? {})) {
    if (typeof workspaceId !== 'string' || workspaceId.length > 200) continue;
    if (!known.has(categoryId)) continue;
    assignments[workspaceId] = categoryId;
  }

  // Collapse state belongs to categories that survive this save; keep it.
  const existing = await readCategories();
  const collapsed = {};
  for (const [categoryId, value] of Object.entries(existing.collapsed ?? {})) {
    if (known.has(categoryId) && value === true) collapsed[categoryId] = true;
  }

  const state = { categories, assignments, collapsed, showHeaders: body?.showHeaders !== false };
  await writeCategories(state);
  const order = body?.cluster === true ? await applyClusters(ctx, state) : null;
  return {
    ok: true,
    categories,
    assignments,
    collapsed,
    showHeaders: state.showHeaders,
    order,
  };
}

/** Expand/collapse one category. Rejects ids that are not in the saved set. */
async function doToggleCategory(ctx, categoryId, collapsed) {
  const state = await readCategories();
  const id = cleanCategoryId(categoryId);
  if (!id || !state.categories.some((category) => category.id === id)) {
    throw new RequestError(404, '没有这个分类。');
  }
  const next = { ...(state.collapsed ?? {}) };
  if (collapsed === true) next[id] = true;
  else delete next[id];
  await writeCategories({ ...state, collapsed: next });
  return { ok: true, categoryId: id, collapsed: next[id] === true };
}

/** Re-attach sessions that match a workspace by cwd but are missing from its list. */
async function doReattach(ctx, sessionIds) {
  const persistence = service(ctx, 'sessionPersistence');
  const attached = [];
  const failed = [];
  for (const sessionId of sessionIds) {
    if (typeof sessionId !== 'string' || !SAFE_ID.test(sessionId)) continue;
    try {
      const snapshot = await persistence?.stat?.(sessionId);
      const cwd = typeof snapshot?.header?.cwd === 'string' ? snapshot.header.cwd : '';
      if (!cwd) {
        failed.push({ sessionId, message: '会话没有记录 cwd' });
        continue;
      }
      const ok = await attachByCwd(ctx, sessionId, cwd);
      if (!ok) {
        failed.push({ sessionId, message: '没有匹配的工作区' });
        continue;
      }
      attached.push(sessionId);
      try {
        if (typeof ctx.emit === 'function') {
          ctx.emit('api-session/added', await sessionSummary(ctx, sessionId));
        }
      } catch (error) {
        warn('announceAttach failed', textOf(error));
      }
    } catch (error) {
      failed.push({ sessionId, message: textOf(error) });
    }
  }
  return { ok: failed.length === 0, attached: attached.length, failed };
}

/** Regroup without touching the saved categories. A drag calls this. */
async function doCluster(ctx) {
  const state = await readCategories();
  const order = await applyClusters(ctx, state);
  return { ok: true, order };
}

async function doArchive(ctx, sessionIds) {
  const registry = service(ctx, 'workspaceRegistry');
  if (!registry || typeof registry.archiveSession !== 'function') {
    throw new RequestError(501, '当前 profile 没有 workspaceRegistry，无法归档。');
  }
  const done = [];
  const failed = [];
  for (const sessionId of sessionIds) {
    if (typeof sessionId !== 'string' || !SAFE_ID.test(sessionId)) continue;
    try {
      await registry.archiveSession(sessionId);
      done.push(sessionId);
    } catch (error) {
      failed.push({ sessionId, message: textOf(error) });
    }
  }
  return { ok: failed.length === 0, archived: done.length, failed };
}

async function doScan(ctx) {
  const persistence = service(ctx, 'sessionPersistence');
  const registry = service(ctx, 'workspaceRegistry');
  let snapshots = [];
  if (persistence && typeof persistence.list === 'function') {
    try {
      snapshots = await persistence.list();
    } catch (error) {
      warn('list failed', textOf(error));
    }
  }
  let workspaces = [];
  if (registry && typeof registry.list === 'function') {
    try {
      workspaces = registry.list();
    } catch (error) {
      warn('registry list failed', textOf(error));
    }
  }
  const byPath = new Map();
  const attachedIds = new Set();
  for (const workspace of workspaces) {
    const where = workspacePath(workspace);
    if (where) byPath.set(norm(where), workspace);
    for (const sessionId of workspace?.sessionIds ?? []) attachedIds.add(String(sessionId));
  }
  const needed = new Set();
  for (const snapshot of snapshots) {
    const id = snapshot?.header?.id;
    if (typeof id === 'string') needed.add(cacheKey(id));
  }
  const cacheInfo = await readCacheInfo(needed);

  const sessions = [];
  for (const snapshot of snapshots) {
    const id = snapshot?.header?.id;
    if (typeof id !== 'string') continue;
    const cwd = typeof snapshot?.header?.cwd === 'string' ? snapshot.header.cwd : '';
    const workspace = cwd ? byPath.get(norm(cwd)) : undefined;
    // DSH groups by the workspace's own sessionIds list, not by cwd, so a
    // session can match a workspace and still render under "未分组".
    const attached =
      attachedIds.has(id) ||
      attachedIds.has(cacheKey(id)) ||
      attachedIds.has(`session-${cacheKey(id)}`);
    sessions.push({
      sessionId: id,
      title: (cacheInfo.get(cacheKey(id)) || {}).title || '',
      preview: (cacheInfo.get(cacheKey(id)) || {}).preview || '',
      cwd,
      workspaceId: workspace && typeof workspace.id === 'string' ? workspace.id : null,
      workspaceTitle: workspace ? String(workspace.title || workspacePath(workspace) || '') : null,
      orphan: !workspace,
      attached,
      // Matches a workspace by cwd but is missing from its sessionIds list: the
      // session shows up as "未分组" even though its workspace exists.
      detached: Boolean(workspace) && !attached,
      subagent: snapshot?.header?.origin === 'subagent',
      sizeBytes: typeof snapshot?.sizeBytes === 'number' ? snapshot.sizeBytes : 0,
      eventCount: typeof snapshot?.eventCount === 'number' ? snapshot.eventCount : 0,
      createdAt: typeof snapshot?.header?.createdAt === 'number' ? snapshot.header.createdAt : 0,
    });
  }
  sessions.sort((a, b) => b.createdAt - a.createdAt);

  // Only orphaned rows need this, and only when the cache had nothing for them.
  // A bounded budget keeps a scan from turning into a log-reading storm.
  const budget = Date.now() + 4000;
  let resolved = 0;
  for (const row of sessions) {
    if (!row.orphan || row.preview) continue;
    if (resolved >= 60 || Date.now() > budget) break;
    resolved += 1;
    row.preview = await readOpening(persistence, row.sessionId);
  }

  return {
    ok: true,
    sessions,
    trash: await listTrash(),
    workspaceCount: workspaces.length,
    home: dshHome(),
  };
}

/* ------------------------------------------------------------------ */
/* transport                                                           */
/* ------------------------------------------------------------------ */

function originVerdict(request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) return fail(403, '拒绝跨站请求');
  const origin = request.headers.get('origin');
  if (origin && /^https?:/i.test(origin)) {
    try {
      const host = request.headers.get('host') || new URL(request.url).host;
      if (new URL(origin).host !== host) return fail(403, '拒绝跨源请求');
    } catch {
      return fail(403, '无效来源');
    }
  }
  return undefined;
}

async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, '缺少请求内容');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) {
        await reader.cancel();
        throw new RequestError(413, '请求内容过大');
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) throw new RequestError(400, '请求内容为空');
  try {
    return JSON.parse(raw);
  } catch {
    throw new RequestError(400, '请求内容不是合法 JSON');
  }
}

async function handle(ctx, request) {
  if (request.method !== 'POST') return fail(405, '请使用 POST');
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json' || request.headers.get(ACTION_HEADER) !== '1') {
    return fail(403, '请从「会话清理」界面发起操作');
  }
  const denied = originVerdict(request);
  if (denied) return denied;
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return fail(error?.status || 400, textOf(error));
  }
  try {
    switch (body?.action) {
      case 'scan':
        return json(200, await doScan(ctx));
      case 'trash': {
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
        return json(200, await doTrash(ctx, sessionId));
      }
      case 'restore': {
        const entryId = typeof body.entryId === 'string' ? body.entryId.trim() : '';
        return json(200, await doRestore(ctx, entryId));
      }
      case 'purge': {
        const entryId = typeof body.entryId === 'string' ? body.entryId.trim() : '';
        return json(200, await doPurge(ctx, entryId));
      }
      case 'archive': {
        const ids = Array.isArray(body.sessionIds) ? body.sessionIds.slice(0, 500) : [];
        return json(200, await doArchive(ctx, ids));
      }
      case 'trash-all': {
        const ids = Array.isArray(body.sessionIds) ? body.sessionIds.slice(0, 500) : [];
        return json(200, await doTrashMany(ctx, ids));
      }
      case 'restore-all': {
        const ids = Array.isArray(body.entryIds) ? body.entryIds.slice(0, 500) : [];
        return json(200, await doRestoreMany(ctx, ids));
      }
      case 'purge-all': {
        const ids = Array.isArray(body.entryIds) ? body.entryIds.slice(0, 500) : [];
        return json(200, await doPurgeMany(ctx, ids));
      }
      case 'reattach': {
        const ids = Array.isArray(body.sessionIds) ? body.sessionIds.slice(0, 500) : [];
        return json(200, await doReattach(ctx, ids));
      }
      case 'categories':
        return json(200, await doCategories(ctx));
      case 'save-categories':
        return json(200, await doSaveCategories(ctx, body));
      case 'toggle-category': {
        const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
        return json(200, await doToggleCategory(ctx, categoryId, body.collapsed === true));
      }
      case 'cluster':
        return json(200, await doCluster(ctx));
      default:
        return fail(400, '未知操作');
    }
  } catch (error) {
    if (error instanceof RequestError) return fail(error.status, error.message);
    warn('action failed', body?.action, textOf(error));
    return fail(500, textOf(error));
  }
}

export function apply(ctx) {
  const install = (scope) => {
    const carrier = scope?.connection?.fetch;
    if (typeof carrier?.register !== 'function') {
      warn('connection.fetch unavailable; session-hygiene route not registered');
      return undefined;
    }
    try {
      const dispose = carrier.register({
        path: ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: (request) => handle(ctx, request),
      });
      if (typeof dispose?.catch === 'function') {
        dispose.catch((error) => warn('route registration failed', textOf(error)));
      }
      return dispose;
    } catch (error) {
      warn('route registration failed', textOf(error));
      return undefined;
    }
  };
  if (typeof ctx.inject === 'function') ctx.inject(['connection'], install);
  else install(ctx);
}
