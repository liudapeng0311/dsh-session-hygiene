/**
 * Host-half smoke test: drives the real route handler against a throwaway
 * DSH_HOME, so scan → trash → restore → purge is exercised end to end without
 * touching the live profile.
 *
 *   node tests/host-smoke.mjs
 */
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const home = path.join(tmpdir(), 'wh-smoke-' + Date.now());
process.env.DSH_HOME = home;

const SESSION_ID = 'session-11111111-2222-3333-4444-555555555555';
const CWD = path.join(home, 'project-alpha');
const GROUP_DIR = path.join(home, 'sessions', '--project-alpha--');
const SESSION_DIR = path.join(GROUP_DIR, SESSION_ID);
const CACHE_DIR = path.join(home, 'storages', 'session_projcache', 'sessions');

await fsp.mkdir(SESSION_DIR, { recursive: true });
await fsp.writeFile(path.join(SESSION_DIR, 'session.v4.jsonl.zstd'), 'x'.repeat(2048));
await fsp.mkdir(CACHE_DIR, { recursive: true });
await fsp.writeFile(
  path.join(CACHE_DIR, '11111111-2222-3333-4444-555555555555.json'),
  JSON.stringify({
    version: 7,
    record: {
      rows: {
        title: { val: '冒烟测试会话' },
        titleInput: { val: { first: { seq: 9, text: '  这是首个用户消息，\n用于生成内容预览。  ' } } },
      },
    },
  }),
);

const events = [];
const calls = [];
const openedWith = [];
let closed = 0;

const services = {
  sessionPersistence: {
    async list() {
      return [
        {
          header: { id: SESSION_ID, cwd: CWD, createdAt: Date.now(), isSeeded: false },
          sizeBytes: 2048,
          eventCount: 3,
        },
      ];
    },
    async stat(id) {
      if (id !== SESSION_ID) return undefined;
      return {
        header: { id, cwd: CWD, createdAt: Date.now(), isSeeded: false },
        location: { kind: 'jsonl', path: SESSION_DIR },
        sizeBytes: 2048,
        eventCount: 2,
      };
    },
    // Read-only open used by the preview fallback when no cache exists.
    async open(id, access) {
      if (id !== SESSION_ID) throw new Error('unknown session');
      openedWith.push(access);
      return {
        async read() {
          return {
            eventState: 'detached',
            events: [
              { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
              {
                type: 'user/message',
                seq: 1,
                time: 2,
                data: { role: 'user', content: [{ type: 'text', text: '从日志里读出的开场白。' }] },
              },
            ],
          };
        },
        async close() {
          closed += 1;
        },
      };
    },
  },
  workspaceRegistry: {
    list() {
      return []; // no workspace claims CWD → the session must read as orphaned
    },
    async resolveByPath(target) {
      if (target !== CWD) return undefined;
      return {
        id: 'ws-1',
        path: CWD,
        title: 'project-alpha',
        async attachSession(id) {
          calls.push(['attachSession', id]);
        },
      };
    },
    async archiveSession(id) {
      calls.push(['archiveSession', id]);
    },
    async unarchiveSession(id) {
      calls.push(['unarchiveSession', id]);
    },
    async unpinSession(id) {
      calls.push(['unpinSession', id]);
    },
  },
};

const { apply } = await import('../index.js');

let handler;
apply({
  get: (name) => services[name],
  inject: (_deps, callback) =>
    callback({
      connection: {
        fetch: {
          register(route) {
            handler = route.fetch;
            calls.push(['registerRoute', route.path, route.methods.join(',')]);
            return () => {};
          },
        },
      },
    }),
  emit: (name, value) => events.push([name, value]),
});

if (typeof handler !== 'function') {
  console.error('FAIL: route was never registered');
  process.exit(1);
}

async function call(payload) {
  const request = new Request('http://127.0.0.1/api/session-hygiene', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dsh-session-hygiene': '1' },
    body: JSON.stringify(payload),
  });
  const response = await handler(request);
  const body = await response.json();
  return { status: response.status, body };
}

const results = [];
const check = (name, condition, detail) => {
  results.push({ name, ok: Boolean(condition), detail });
  console.log((condition ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

/* ---- scan ---- */
const scan1 = await call({ action: 'scan' });
check('scan returns 200', scan1.status === 200, 'status=' + scan1.status);
check('scan sees one session', scan1.body.sessions?.length === 1, JSON.stringify(scan1.body.sessions?.[0]?.sessionId));
check('orphan detected (no workspace claims cwd)', scan1.body.sessions?.[0]?.orphan === true);
check('title read from projection cache', scan1.body.sessions?.[0]?.title === '冒烟测试会话', scan1.body.sessions?.[0]?.title);
check(
  'opening prompt read as a preview',
  scan1.body.sessions?.[0]?.preview === '这是首个用户消息， 用于生成内容预览。',
  JSON.stringify(scan1.body.sessions?.[0]?.preview),
);
check('trash starts empty', Array.isArray(scan1.body.trash) && scan1.body.trash.length === 0);

/* ---- trash ---- */
const trashed = await call({ action: 'trash', sessionId: SESSION_ID });
check('trash returns 200', trashed.status === 200, JSON.stringify(trashed.body).slice(0, 160));
const entryId = trashed.body.entryId;
check('trash reports an entry id', typeof entryId === 'string' && entryId.length > 0, entryId);
check('session dir left its old home', !(await fsp.stat(SESSION_DIR).catch(() => null)));
check(
  'log landed in the trash',
  Boolean(await fsp.stat(path.join(home, 'storages', 'session-hygiene', 'trash', entryId, 'session.v4.jsonl.zstd')).catch(() => null)),
);
const manifest = JSON.parse(
  await fsp.readFile(path.join(home, 'storages', 'session-hygiene', 'trash', entryId, 'entry.json'), 'utf8'),
);
check('entry.json records the origin', manifest.from === SESSION_DIR, manifest.from);
check('entry.json records the session id', manifest.sessionId === SESSION_ID, manifest.sessionId);
check(
  'cache stays with the trashed session (restore keeps its title)',
  Boolean(await fsp.stat(path.join(CACHE_DIR, '11111111-2222-3333-4444-555555555555.json')).catch(() => null)),
);
check('row removal announced', events.some(([name, value]) => name === 'api-session/removed' && value === SESSION_ID), JSON.stringify(events));
check('work stopped through archiveSession', calls.some(([name]) => name === 'archiveSession'));

/* ---- scan after trash ---- */
const scan2 = await call({ action: 'scan' });
check('scan now shows the trash entry', scan2.body.trash?.length === 1, JSON.stringify(scan2.body.trash?.[0]?.sessionId));
check('trashed session carries its title', scan2.body.trash?.[0]?.title === '冒烟测试会话', scan2.body.trash?.[0]?.title);
check('trashed session carries its size', scan2.body.trash?.[0]?.sizeBytes > 0, String(scan2.body.trash?.[0]?.sizeBytes));

/* ---- restore ---- */
const restored = await call({ action: 'restore', entryId });
check('restore returns 200', restored.status === 200, JSON.stringify(restored.body).slice(0, 160));
check('log is back at its origin', Boolean(await fsp.stat(path.join(SESSION_DIR, 'session.v4.jsonl.zstd')).catch(() => null)));
check('trash entry consumed', !(await fsp.stat(path.join(home, 'storages', 'session-hygiene', 'trash', entryId)).catch(() => null)));
check('row return announced', events.some(([name]) => name === 'api-session/added'));
check(
  'restore re-attaches the session to its workspace',
  calls.some(([name, value]) => name === 'attachSession' && value === SESSION_ID),
  JSON.stringify(calls.filter(([name]) => name === 'attachSession')),
);
check(
  'restore unarchives the session trashing hid',
  calls.some(([name, value]) => name === 'unarchiveSession' && value === SESSION_ID),
  JSON.stringify(calls.filter(([name]) => name === 'unarchiveSession')),
);

const addedPayloads = events.filter(([name]) => name === 'api-session/added').map(([, value]) => value);
const lastAdded = addedPayloads[addedPayloads.length - 1];
check(
  'added event carries a SessionSummary, not an id',
  Boolean(lastAdded) && typeof lastAdded === 'object' && typeof lastAdded.sessionId === 'string',
  JSON.stringify(lastAdded),
);
check(
  'summary carries a finite updatedAt',
  Boolean(lastAdded) && Number.isFinite(lastAdded.updatedAt) && lastAdded.updatedAt > 0,
  lastAdded && String(lastAdded.updatedAt),
);

/* ---- preview fallback when the projection cache has nothing ---- */
await fsp.rm(path.join(CACHE_DIR, '11111111-2222-3333-4444-555555555555.json'), { force: true });
const scanNoCache = await call({ action: 'scan' });
check(
  'preview falls back to the session log',
  scanNoCache.body.sessions?.[0]?.preview === '从日志里读出的开场白。',
  JSON.stringify(scanNoCache.body.sessions?.[0]?.preview),
);
check('fallback opened the log read-only', openedWith.every((access) => access === 'read'), JSON.stringify(openedWith));
check('fallback closed its handle', closed > 0, String(closed));

/* ---- guards ---- */
const noHeader = await handler(
  new Request('http://127.0.0.1/api/session-hygiene', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'scan' }),
  }),
);
check('missing action header is rejected', noHeader.status === 403, 'status=' + noHeader.status);

const traversal = await call({ action: 'purge', entryId: '../../etc' });
check('path traversal in entry id is rejected', traversal.status === 400, 'status=' + traversal.status);

const badId = await call({ action: 'trash', sessionId: '../escape' });
check('path traversal in session id is rejected', badId.status === 400, 'status=' + badId.status);

const missing = await call({ action: 'trash', sessionId: 'session-does-not-exist' });
check('unknown session reports not found', missing.status === 404, 'status=' + missing.status);

/* ---- bulk trash + purge ---- */
const again = await call({ action: 'trash-all', sessionIds: [SESSION_ID] });
check('bulk trash returns 200', again.status === 200, 'status=' + again.status);
check('bulk trash reports one session', again.body.trashed === 1, JSON.stringify(again.body));

const scanAfterBulk = await call({ action: 'scan' });
const bulkEntry = scanAfterBulk.body.trash.find((entry) => entry.sessionId === SESSION_ID);
check('bulk trash produced a trash entry', Boolean(bulkEntry), bulkEntry && bulkEntry.id);
check(
  'trash entry keeps the opening prompt',
  Boolean(bulkEntry && bulkEntry.preview && bulkEntry.preview.startsWith('从日志里读出的开场白')),
  bulkEntry && bulkEntry.preview,
);

const purged = await call({ action: 'purge', entryId: bulkEntry ? bulkEntry.id : 'missing' });
check('purge returns 200', purged.status === 200, 'status=' + purged.status);
check(
  'purge removes the entry for good',
  !(await fsp.stat(path.join(home, 'storages', 'session-hygiene', 'trash', bulkEntry ? bulkEntry.id : 'missing')).catch(() => null)),
);
check(
  'purge also drops the projection cache',
  !(await fsp.stat(path.join(CACHE_DIR, '11111111-2222-3333-4444-555555555555.json')).catch(() => null)),
);

/* ---- bulk restore + bulk purge ---- */
// The store was purged above; recreate it so the bulk actions have a target.
await fsp.mkdir(SESSION_DIR, { recursive: true });
await fsp.writeFile(path.join(SESSION_DIR, 'session.v4.jsonl.zstd'), 'y'.repeat(1024));

const thirdTrash = await call({ action: 'trash', sessionId: SESSION_ID });
check('prepared another trash entry', thirdTrash.status === 200, 'status=' + thirdTrash.status);

const restoreAllResult = await call({ action: 'restore-all', entryIds: [thirdTrash.body.entryId] });
check('restore-all returns 200', restoreAllResult.status === 200, 'status=' + restoreAllResult.status);
check('restore-all reports one session', restoreAllResult.body.restored === 1, JSON.stringify(restoreAllResult.body));
check(
  'log is back after restore-all',
  Boolean(await fsp.stat(path.join(SESSION_DIR, 'session.v4.jsonl.zstd')).catch(() => null)),
);

const fourthTrash = await call({ action: 'trash', sessionId: SESSION_ID });
const purgeAllResult = await call({ action: 'purge-all', entryIds: [fourthTrash.body.entryId] });
check('purge-all returns 200', purgeAllResult.status === 200, 'status=' + purgeAllResult.status);
check('purge-all reports one entry', purgeAllResult.body.purged === 1, JSON.stringify(purgeAllResult.body));

const finalScan = await call({ action: 'scan' });
check('trash is empty after purge-all', finalScan.body.trash.length === 0, JSON.stringify(finalScan.body.trash));

/* ---- workspace categories ---- */
// Swap in a registry that can actually reorder, so clustering is exercised.
const order = ['ws-a', 'ws-b', 'ws-c'];
// Simulates the shell's own late `insertBefore` landing mid-chain.
let sabotage = 0;
services.workspaceRegistry = {
  list() {
    return order.map((id) => ({ id, title: 'WS ' + id, path: 'C:\\' + id, sessionIds: [] }));
  },
  async insertBefore(id, beforeId) {
    const from = order.indexOf(id);
    if (from >= 0) order.splice(from, 1);
    const to = beforeId === undefined ? order.length : order.indexOf(beforeId);
    order.splice(to < 0 ? order.length : to, 0, id);
    calls.push(['insertBefore', id, beforeId]);
    if (sabotage > 0) {
      sabotage -= 1;
      const moved = order.pop();
      order.splice(1, 0, moved);
    }
    return order.slice();
  },
};

const initialCategories = await call({ action: 'categories' });
check(
  'categories lists every workspace',
  initialCategories.body.workspaces?.length === 3,
  JSON.stringify(initialCategories.body.workspaces),
);

const savedCategories = await call({
  action: 'save-categories',
  categories: [
    { id: 'work', name: '工作' },
    { id: 'lab', name: '实验' },
  ],
  assignments: { 'ws-c': 'work', 'ws-a': 'lab' },
  cluster: true,
});
check('save-categories returns 200', savedCategories.status === 200, 'status=' + savedCategories.status);
check(
  'clustering places each category together',
  JSON.stringify(order) === JSON.stringify(['ws-c', 'ws-a', 'ws-b']),
  JSON.stringify(order),
);
check(
  'unassigned workspaces sort last',
  order[2] === 'ws-b',
  JSON.stringify(order),
);

const reread = await call({ action: 'categories' });
check('categories persist', reread.body.categories?.length === 2, JSON.stringify(reread.body.categories));
check(
  'category order is preserved on save',
  JSON.stringify((reread.body.categories || []).map((category) => category.name)) ===
    JSON.stringify(['工作', '实验']),
  JSON.stringify(reread.body.categories),
);
check(
  'assignment survives the round trip',
  reread.body.workspaces?.find((w) => w.id === 'ws-c')?.categoryId === 'work',
  JSON.stringify(reread.body.workspaces),
);

const headersOff = await call({
  action: 'save-categories',
  categories: [
    { id: 'work', name: '工作' },
    { id: 'lab', name: '实验' },
  ],
  assignments: { 'ws-c': 'work', 'ws-a': 'lab' },
  showHeaders: false,
  cluster: false,
});
check('showHeaders is persisted', headersOff.body.showHeaders === false, JSON.stringify(headersOff.body.showHeaders));
const rereadHidden = await call({ action: 'categories' });
check('categories report showHeaders', rereadHidden.body.showHeaders === false, String(rereadHidden.body.showHeaders));

const clusterNoop = await call({ action: 'cluster' });
check('cluster is a no-op when already grouped', clusterNoop.status === 200, 'status=' + clusterNoop.status);
check(
  'no-op cluster leaves the order untouched',
  JSON.stringify(order) === JSON.stringify(['ws-c', 'ws-a', 'ws-b']),
  JSON.stringify(order),
);

order.splice(0, order.length, 'ws-b', 'ws-c', 'ws-a');
const clustered = await call({ action: 'cluster' });
check('cluster regroups a scattered order', clustered.status === 200, 'status=' + clustered.status);
check(
  'cluster restores category blocks',
  JSON.stringify(order) === JSON.stringify(['ws-c', 'ws-a', 'ws-b']),
  JSON.stringify(order),
);

sabotage = 1;
order.splice(0, order.length, 'ws-b', 'ws-c', 'ws-a');
const raced = await call({ action: 'cluster' });
check(
  'cluster converges after a concurrent move',
  JSON.stringify(order) === JSON.stringify(['ws-c', 'ws-a', 'ws-b']),
  JSON.stringify(order),
);

const toggled = await call({ action: 'toggle-category', categoryId: 'work', collapsed: true });
check('toggle-category returns 200', toggled.status === 200, 'status=' + toggled.status);
check('toggle-category reports collapsed', toggled.body.collapsed === true, JSON.stringify(toggled.body));
const afterToggle = await call({ action: 'categories' });
check('collapse persists', afterToggle.body.collapsed?.work === true, JSON.stringify(afterToggle.body.collapsed));

const saveWithCollapse = await call({
  action: 'save-categories',
  categories: [
    { id: 'work', name: '工作' },
    { id: 'lab', name: '实验' },
  ],
  assignments: { 'ws-c': 'work', 'ws-a': 'lab' },
  showHeaders: true,
  cluster: false,
});
check(
  'a save keeps the collapse state',
  saveWithCollapse.body.collapsed?.work === true,
  JSON.stringify(saveWithCollapse.body.collapsed),
);

const expanded = await call({ action: 'toggle-category', categoryId: 'work', collapsed: false });
check('expanding clears the flag', expanded.body.collapsed === false, JSON.stringify(expanded.body));
const afterExpand = await call({ action: 'categories' });
check(
  'expanded category is no longer collapsed',
  afterExpand.body.collapsed?.work === undefined,
  JSON.stringify(afterExpand.body.collapsed),
);

const unknownToggle = await call({ action: 'toggle-category', categoryId: 'nope', collapsed: true });
check('unknown category is rejected', unknownToggle.status === 404, 'status=' + unknownToggle.status);

const badCategory = await call({
  action: 'save-categories',
  categories: [{ id: 'work', name: '工作' }],
  assignments: { 'ws-a': 'does-not-exist' },
  cluster: false,
});
check(
  'unknown category ids are dropped',
  JSON.stringify(badCategory.body.assignments) === '{}',
  JSON.stringify(badCategory.body.assignments),
);

/* ---- create a workspace from a category band ---- */
const projectBeta = path.join(home, 'project-beta');
await fsp.mkdir(projectBeta, { recursive: true });

let picked = projectBeta;
services.directoryPicker = {
  capability: () => ({
    kind: 'native',
    async pick() {
      return picked;
    },
  }),
};
services.workspaceRegistry.create = async (target, title) => {
  order.unshift('ws-new');
  calls.push(['createWorkspace', target, title]);
  return { id: 'ws-new', path: target, title: title || 'ws-new', sessionIds: [] };
};

const createdWorkspace = await call({ action: 'create-workspace', categoryId: 'work' });
check(
  'create-workspace returns 200',
  createdWorkspace.status === 200,
  JSON.stringify(createdWorkspace.body).slice(0, 160),
);
check(
  'create-workspace registers the picked directory',
  calls.some(([name, target]) => name === 'createWorkspace' && target === projectBeta),
  JSON.stringify(calls.filter(([name]) => name === 'createWorkspace')),
);
check(
  'create-workspace files it under the category',
  createdWorkspace.body.categorized === true && createdWorkspace.body.workspaceId === 'ws-new',
  JSON.stringify(createdWorkspace.body),
);

const afterCreate = await call({ action: 'categories' });
const createdRow = (afterCreate.body.workspaces || []).find((workspace) => workspace.id === 'ws-new');
check('the new workspace carries the category', createdRow?.categoryId === 'work', JSON.stringify(createdRow));

picked = null;
const cancelledCreate = await call({ action: 'create-workspace', categoryId: 'work' });
check(
  'cancelling the picker creates nothing',
  cancelledCreate.status === 200 && cancelledCreate.body.cancelled === true,
  JSON.stringify(cancelledCreate.body),
);

/* ---- summary ---- */
await fsp.rm(home, { recursive: true, force: true });
const failed = results.filter((item) => !item.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
process.exit(failed.length === 0 ? 0 : 1);
