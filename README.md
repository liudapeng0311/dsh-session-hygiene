# dsh-session-hygiene

English | [中文](https://github.com/liudapeng0311/dsh-session-hygiene/blob/main/README.zh.md)

Three gaps in the shipped DSH sidebar, closed by one plugin:

1. **A session can be archived but never deleted.** *Delete session (to trash)*
   moves the log out of the session store into a recycle bin instead of
   unlinking it, so it can be restored.
2. **Deleting a workspace leaves its sessions behind.** They stay on disk with a
   `cwd` that matches nothing, so the sidebar has nowhere to list them.
   **Settings → Session cleanup** finds those orphans and lets you archive or
   trash them.
3. **Workspaces cannot be grouped.** **Settings → Workspace categories** adds
   categories, sidebar headers, drag-to-assign and collapse.

Everything is additive: no shipped row is replaced or hidden, and no DOM outside
these components is rewritten.

## Where it shows up

| Surface | What you get |
| --- | --- |
| Session row `...` menu | **Delete session (to trash)** |
| Sidebar workspace list | Category headers, and drag-to-assign |
| Settings → **Session cleanup** | Orphan scan, trash, restore, permanent delete |
| Settings → **Workspace categories** | Categories, assignment, ordering, header toggle |

## Install

From the npm registry, either from DSH's **Plugins** page or through the agent:

```
plugin_manager install_bundle dsh-session-hygiene
```

To install a local checkout instead, pass its absolute path:

```
plugin_manager install_bundle <path to this checkout>
```

Host-side JavaScript does not hot-reload: restart the host once after install.

## Delete a session

1. In the sidebar, point at a session and open its `...` menu.
2. Choose **Delete session (to trash)**.
3. The row leaves the list immediately; the data is moved, not deleted.

Under the hood, in order: running work is stopped and the row is hidden, the id
is detached from every workspace and unpinned, `<home>/sessions/<group>/<id>/`
is renamed into the trash, a `preview` is recorded, and `api-session/removed`
lets open pages drop the row without a reload. The projection cache stays, so a
restored session keeps its title and opening prompt.

If the move fails with **"the session data is still in use"**, another view still
holds the directory open: switch to a different conversation and retry. When the
move fails the archive is rolled back, so the session keeps showing as before.

## Clean up sessions from deleted workspaces

Open **Settings → Session cleanup**. The page scans as it opens; **Rescan**
repeats it.

**Orphaned sessions** are stored sessions whose `header.cwd` matches no
registered workspace. Each row shows its title, opening preview, the workspace it
used to belong to, the directory name, and its size.

- Per row: **Move to trash**.
- Bulk: **Archive N** — hides them in the shell's archive, skipping subagent
  sessions, which are usually owned by a parent session.
- Bulk: **Move all to trash** — includes subagents, and asks for confirmation.

**Detached** sessions are a separate case: their `cwd` matches a workspace that
does not list them, so the sidebar files them under *Ungrouped* even though the
workspace exists. They appear as a strip above the tabs with **Attach all**,
which is cheaper and safer than trashing a healthy session.

## The trash: restore or delete permanently

The **Trash** tab lists what has been moved.

- **Restore** renames the directory back to its recorded path and re-attaches the
  session to the workspace that owns that `cwd`. It refuses (`409`) when
  something already occupies the original path — move or delete that first. If
  the original workspace no longer exists, the session comes back ungrouped,
  because nothing owns its `cwd` any more.
- **Delete permanently** unlinks the directory and drops its projection-cache
  entry. This is the only irreversible action, and it always names exactly what
  it removes; a second click confirms it.

## Group workspaces into categories

Open **Settings → Workspace categories**.

- **Add category**, rename inline, reorder with ↑/↓, **Delete** (its workspaces
  fall back to unclassified).
- Assign a workspace from its dropdown, or **drag a workspace row onto a
  category header** in the sidebar.
- **Save and regroup** writes the assignment and reorders the workspace registry
  so each category's rows are contiguous; unclassified workspaces sort last. The
  shipped drag-to-reorder keeps working — this only reorders on save.
- **Clear assignments** sends every workspace back to unclassified without
  deleting the categories themselves.
- Click a header to collapse or expand a category; the collapsed state persists.
  **Show category headers in the sidebar** hides the bands without losing the
  assignments.

Rows under a band are indented one step, so the band reads as their heading
instead of a sibling. A category only gets a header while its rows form one
contiguous block; a split category shows no header rather than a header over rows
that belong elsewhere. Both the bands and the indent belong to this plugin and are
undone when it goes away, so the sidebar returns to exactly what the shell
rendered.

## Where your data goes

```
<home>/storages/session-hygiene/
  categories.json
  trash/<sessionId>__<stamp>/
    entry.json
    session.v4.jsonl.zstd ...
```

`entry.json` records `sessionId`, `cwd`, `from` (the original directory),
`title`, `preview`, `createdAt`, `sizeBytes` and `deletedAt`. It is the only file
this plugin authors, and it is what makes a restore possible.

Delete that directory tree to empty the trash by hand. The projection cache is
deliberately kept on trash (a derived artifact, so a restored session still shows
its title) and removed on purge.

## Remove

Remove the bundle from DSH's Plugins page. The sidebar loses its category bands
immediately, and no shipped row is left in a modified state.

**Empty or restore the trash first.** Removing the plugin leaves
`<home>/storages/session-hygiene/` on disk, but sessions already in the trash
no longer have any UI that can restore them — you would have to rename each
directory back by hand, following its `entry.json`.

## Known limits

- Orphan detection compares a session's `header.cwd` against the workspace
  registry's recorded directory. A session whose `cwd` was renamed on disk reads
  as orphaned even though its workspace still exists.
- Deleting a workspace still does not warn about its sessions at delete time;
  this plugin surfaces them afterwards, in Settings. Intercepting the shipped
  delete flow would mean taking over `sidebar.workspaces`, which is a `single`
  slot owned by the shell.
- Subagent sessions are listed and marked separately, excluded from *Archive
  all*, and included in bulk trash.
- Category headers require contiguity; dropping a row *between* two rows derives
  its category from the header above, which is a guess when a category holds a
  single row.
- Host-side JavaScript does not hot-reload: restart the host after install or
  update.

## Development

```
node tests/host-smoke.mjs
```

The smoke test drives the real route handler through scan → trash → restore →
purge against a throwaway `DSH_HOME`, so it never touches a live profile. It is
excluded from the published package by `files`.

For maintainers, the surfaces are registered as:

| Slot | Id | Purpose |
| --- | --- | --- |
| `sidebar.workspaces.session.menu.item` | `session-hygiene-trash` | Delete row, ordered directly above Archive |
| `settings.section` | `session-hygiene` | Session cleanup page |
| `settings.section` | `workspace-categories` | Categories page |
| `settings.section.icon` | `session-hygiene`, `workspace-categories` | Nav glyphs |
| `sidebar.footer.action` | `session-hygiene-labels` | Renders nothing; mounts the DOM watcher that draws category bands |
