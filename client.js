/**
 * dsh-session-hygiene — browser half.
 *
 * Two contributions, both on slots that exist for outside plugins:
 *
 *   sidebar.workspaces.session.menu.item   one row in a session's "..." menu
 *   settings.section                       a Session cleanup page
 *
 * Visual conventions follow the shipped UI: only `--dsw-alias-*` tokens, no
 * imported client packages, no DOM outside the components. The menu row is a
 * plain `role="menuitem"` button because the shared menu owns keyboard
 * navigation and dismisses on a selection it sees.
 */
window.__ModuleLoader__.load({
  id: 'dsh-session-hygiene',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const ROUTE = '/api/session-hygiene';
    const HEADER = 'x-dsh-session-hygiene';
    const NS = 'dsh-session-hygiene';

    /* -------------------------------------------------------------- */
    /* text                                                           */
    /* -------------------------------------------------------------- */

    const ZH = {
      nav: '会话清理',
      title: '会话清理',
      subtitle: '工作区已被删除的会话，以及你在这里删掉的所有东西。',
      loading: '正在扫描会话…',
      refresh: '重新扫描',
      emptyOrphans: '没有孤儿会话。每个会话都还属于某个工作区。',
      emptyTrash: '回收站是空的。',
      sectionOrphans: '孤儿会话',
      sectionTrash: '回收站',
      sectionOrphansHint: '这些会话仍在磁盘上，但创建它们的工作区已不在注册表里。',
      sectionTrashHint: '恢复会放回原处，彻底删除不可撤销。',
      restoreAll: '全部还原',
      purgeAll: '全部彻底删除',
      confirmPurgeAll: '确认彻底删除 {count} 项',
      restoreDone: '已还原 {count} 个会话。',
      restoreFailed: '{count} 个会话还原失败。',
      purgeDone: '已彻底删除 {count} 项。',
      purgeFailed: '{count} 项彻底删除失败。',
      detachedHint: '{count} 个会话没挂载到工作区，侧栏会显示为「未分组」。',
      reattachAll: '全部挂回',
      reattachDone: '已挂回 {count} 个会话。',
      reattachFailed: '{count} 个会话挂回失败。',
      categoriesNav: '工作区分类',
      categoriesTitle: '工作区分类',
      categoriesSubtitle: '给工作区分组；保存后会按分类把它们排在一起。',
      categoriesHint: '分类按这里的顺序排列，未分类的工作区排在最后。',
      assignHint: '给每个工作区选一个分类。',
      addCategory: '新增分类',
      newCategory: '新分类',
      categoryName: '分类名称',
      deleteCategory: '删除',
      moveUp: '上移',
      moveDown: '下移',
      uncategorized: '未分类',
      saveAndCluster: '保存并聚拢',
      clusteredDone: '已按 {count} 个工作区重新排序。',
      noCategories: '还没有分类。先新增一个，再给工作区选分类。',
      showHeaders: '在侧边栏显示分类标题',
      addWorkspaceHere: '在这个分类下新建工作区',
      clearAssignments: '清空归属',
      confirmClear: '确认清空全部归属',
      clearedDone: '已清空全部归属，现在可以重新分配。',
      columnSession: '会话',
      columnOrigin: '原属',
      columnSize: '体积',
      columnWhen: '删除于',
      unknownWorkspace: '未知工作区',
      noWorkspace: '无工作区',
      moveToTrash: '移入回收站',
      archiveAll: '全部归档',
      archiveCount: '归档 {count} 项',
      trashAll: '全部移入回收站',
      confirmTrashAll: '确认移入 {count} 项',
      trashDone: '已移入回收站 {count} 个会话。',
      trashFailed: '{count} 个会话移入失败。',
      restore: '恢复',
      purge: '彻底删除',
      confirmPurge: '确认彻底删除',
      cancel: '取消',
      menuTrash: '删除会话（移入回收站）',
      menuTrashing: '正在移入回收站…',
      menuFailed: '失败，点此重试',
      menuHint: '可恢复：会话会进入「会话清理」的回收站。',
      archiveDone: '已归档 {count} 个会话。',
      archiveFailed: '{count} 个会话归档失败。',
      actionFailed: '操作失败：{message}',
      countOrphans: '{count} 个孤儿',
      countTrash: '回收站 {count} 项',
      trashHint: '删除会先停掉会话正在跑的工作。文件会一直保留在磁盘上，直到你彻底删除。',
      orphanSession: '孤儿',
      subagentSession: '子代理',
    };
    const EN = {
      nav: 'Session cleanup',
      title: 'Session cleanup',
      subtitle: 'Sessions whose workspace is gone, plus everything you deleted here.',
      loading: 'Scanning sessions…',
      refresh: 'Rescan',
      emptyOrphans: 'No orphaned sessions. Every stored session still belongs to a workspace.',
      emptyTrash: 'The trash is empty.',
      sectionOrphans: 'Orphaned sessions',
      sectionTrash: 'Trash',
      sectionOrphansHint:
        'These sessions are still on disk, but the workspace they were created in is no longer registered.',
      sectionTrashHint: 'Restore puts a session back; permanent deletion cannot be undone.',
      restoreAll: 'Restore all',
      purgeAll: 'Delete all permanently',
      confirmPurgeAll: 'Delete {count} permanently',
      restoreDone: 'Restored {count} session(s).',
      restoreFailed: 'Could not restore {count} session(s).',
      purgeDone: 'Permanently deleted {count} item(s).',
      purgeFailed: 'Could not delete {count} item(s).',
      detachedHint: '{count} session(s) are not attached to a workspace and show as ungrouped.',
      reattachAll: 'Attach all',
      reattachDone: 'Attached {count} session(s).',
      reattachFailed: 'Could not attach {count} session(s).',
      categoriesNav: 'Workspace categories',
      categoriesTitle: 'Workspace categories',
      categoriesSubtitle: 'Group workspaces; saving places each category together.',
      categoriesHint: 'Categories follow this order; unassigned workspaces go last.',
      assignHint: 'Pick a category for each workspace.',
      addCategory: 'Add category',
      newCategory: 'Category',
      categoryName: 'Category name',
      deleteCategory: 'Delete',
      moveUp: 'Move up',
      moveDown: 'Move down',
      uncategorized: 'Uncategorized',
      saveAndCluster: 'Save and regroup',
      clusteredDone: 'Reordered {count} workspace(s).',
      noCategories: 'No categories yet. Add one, then assign workspaces to it.',
      showHeaders: 'Show category headers in the sidebar',
      addWorkspaceHere: 'Create a workspace in this category',
      clearAssignments: 'Clear assignments',
      confirmClear: 'Clear all assignments',
      clearedDone: 'Assignments cleared — you can reassign now.',
      columnSession: 'Session',
      columnOrigin: 'Was in',
      columnSize: 'Size',
      columnWhen: 'Deleted',
      unknownWorkspace: 'unknown workspace',
      noWorkspace: 'no workspace',
      moveToTrash: 'Move to trash',
      archiveAll: 'Archive all',
      archiveCount: 'Archive {count}',
      trashAll: 'Move all to trash',
      confirmTrashAll: 'Move {count} to trash',
      trashDone: 'Moved {count} session(s) to the trash.',
      trashFailed: 'Could not move {count} session(s) to the trash.',
      restore: 'Restore',
      purge: 'Delete permanently',
      confirmPurge: 'Confirm permanent delete',
      cancel: 'Cancel',
      menuTrash: 'Delete session (to trash)',
      menuTrashing: 'Moving to trash…',
      menuFailed: 'Failed — retry',
      menuHint: 'Recoverable: the session goes to the Session cleanup trash.',
      archiveDone: 'Archived {count} session(s).',
      archiveFailed: 'Could not archive {count} session(s).',
      actionFailed: 'Action failed: {message}',
      countOrphans: '{count} orphaned',
      countTrash: '{count} in trash',
      trashHint:
        "Deleting stops the session's running work first. Files stay on disk until you delete them permanently.",
      orphanSession: 'orphaned',
      subagentSession: 'subagent',
    };

    let bound = null;
    function resolveDictionary(ctx) {
      try {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined;
        if (!locale || typeof locale.register !== 'function') return;
        locale.register(NS, 'zh', ZH);
        locale.register(NS, 'en', EN);
        if (typeof locale.bind === 'function') bound = locale.bind(NS);
      } catch (error) {
        /* the built-in dictionary below is enough on its own */
      }
    }

    function activeDictionary() {
      try {
        const doc = typeof document !== 'undefined' ? document.documentElement : undefined;
        const lang = doc ? doc.getAttribute('lang') || '' : '';
        if (lang.toLowerCase().startsWith('en')) return EN;
      } catch {
        /* fall through */
      }
      return ZH;
    }

    function t(key, vars) {
      let value;
      if (bound) {
        try {
          value = bound(key);
        } catch {
          value = undefined;
        }
      }
      if (typeof value !== 'string' || value.length === 0) {
        const dict = activeDictionary();
        value = dict[key] || ZH[key] || key;
      }
      if (vars) {
        for (const name of Object.keys(vars)) {
          value = value.split('{' + name + '}').join(String(vars[name]));
        }
      }
      return value;
    }

    /* -------------------------------------------------------------- */
    /* host calls                                                     */
    /* -------------------------------------------------------------- */

    async function post(body) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [HEADER]: '1' },
        body: JSON.stringify(body),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || payload.ok === false) {
        throw new Error((payload && payload.message) || 'HTTP ' + response.status);
      }
      return payload;
    }

    /* -------------------------------------------------------------- */
    /* formatting                                                     */
    /* -------------------------------------------------------------- */

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || bytes <= 0) return '—';
      const units = ['B', 'KB', 'MB', 'GB'];
      let value = bytes;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return (unit === 0 ? String(value) : value.toFixed(1)) + ' ' + units[unit];
    }

    function formatDate(ms) {
      if (typeof ms !== 'number' || ms <= 0) return '—';
      try {
        return new Date(ms).toLocaleString();
      } catch {
        return '—';
      }
    }

    function basename(target) {
      if (typeof target !== 'string' || target.length === 0) return '';
      const parts = target.split(/[\\/]/).filter(Boolean);
      return parts.length > 0 ? parts[parts.length - 1] : target;
    }

    /**
     * A row's heading. Some cached titles are just the session id (or a bare
     * uuid), which identifies nothing; those rows fall back to the opening
     * prompt so the list reads as content rather than identifiers.
     */
    function headingFor(item) {
      const title = typeof item.title === 'string' ? item.title : '';
      const preview = typeof item.preview === 'string' ? item.preview : '';
      const id = typeof item.sessionId === 'string' ? item.sessionId : '';
      const bare = id.replace(/^session-/, '');
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(title.trim());
      if (!title || title === id || title === bare || uuidLike) return preview || title || id;
      return title;
    }

    /* -------------------------------------------------------------- */
    /* styles                                                         */
    /* -------------------------------------------------------------- */

    const S = {
      // Copied metric-for-metric from the shipped context-menu row in the
      // frontend bundle (`._item_1p5el_105`): 34px tall, `6px 8px` padding, 6px
      // gap, 14px icon box, radius from `--dsw-radius-md`. Reproducing these
      // values is what keeps this row on the same grid as the built-ins.
      menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        minHeight: '34px',
        padding: '6px 8px',
        border: 'none',
        borderRadius: 'var(--dsw-radius-md)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'inherit',
        fontSize: '13px',
        lineHeight: '20px',
        textAlign: 'left',
        cursor: 'pointer',
      },
      // `._itemIcon_1p5el_165`
      menuItemIcon: {
        display: 'inline-flex',
        flex: 'none',
        width: '14px',
        height: '14px',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--dsw-alias-menu-icon)',
      },
      // `._itemLabel_1p5el_208`
      menuItemLabel: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      page: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px 24px 40px',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
      },
      loading: {
        padding: '24px 0',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '13px',
      },
      headerRow: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
      },
      title: { margin: '0 0 6px', fontSize: '17px', fontWeight: 600, lineHeight: '24px' },
      subtitle: { margin: 0, color: 'var(--dsw-alias-label-secondary)', lineHeight: '20px' },
      badge: {
        display: 'inline-block',
        marginLeft: '8px',
        padding: '0 8px',
        borderRadius: '999px',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        fontWeight: 500,
      },
      strip: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      stripText: {
        flex: 1,
        minWidth: 0,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '18px',
      },
      checkboxRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      input: {
        flex: 1,
        minWidth: 0,
        padding: '4px 8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '6px',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'inherit',
        fontSize: '13px',
      },
      select: {
        padding: '4px 8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '6px',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'inherit',
        fontSize: '12px',
      },
      iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
      },
      toolbar: {
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
      },
      toolbarActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      },
      toolbarHint: {
        flex: 1,
        minWidth: 0,
        margin: 0,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '18px',
      },
      // Segmented control, the shape the settings nav itself uses for its active
      // row: a filled track with the selected cell raised onto layer-1. An
      // underline was too quiet here — the brand token is near-black in the light
      // theme, so the only cue was a thin dark rule.
      tabs: {
        display: 'inline-flex',
        alignSelf: 'flex-start',
        gap: '2px',
        padding: '2px',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      tab: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        border: '0',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontFamily: 'inherit',
        fontSize: '13px',
        lineHeight: '20px',
        cursor: 'pointer',
      },
      tabActive: {
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontWeight: 600,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
      },
      tabCount: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: '12px',
        fontWeight: 400,
      },
      button: {
        padding: '5px 12px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '7px',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '12px',
        cursor: 'pointer',
      },
      buttonDanger: {
        padding: '5px 12px',
        border: '1px solid var(--dsw-alias-state-error-primary)',
        borderRadius: '7px',
        background: 'transparent',
        color: 'var(--dsw-alias-state-error-primary)',
        font: 'inherit',
        fontSize: '12px',
        cursor: 'pointer',
      },
      buttonQuiet: {
        padding: '5px 10px',
        border: '0',
        borderRadius: '7px',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: '12px',
        cursor: 'pointer',
      },
      section: {
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
      },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        borderTop: '1px solid var(--dsw-alias-border-l1)',
      },
      rowMain: { flex: 1, minWidth: 0 },
      rowTitle: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: '20px',
      },
      rowMeta: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: '12px',
        lineHeight: '17px',
      },
      // The opening prompt, one line deep. Same size as the meta line but a step
      // stronger, so title > preview > meta reads as a hierarchy.
      rowPreview: {
        marginTop: '1px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
        lineHeight: '17px',
      },
      actions: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
      empty: {
        padding: '16px',
        color: 'var(--dsw-alias-label-secondary)',
        borderTop: '1px solid var(--dsw-alias-border-l1)',
      },
      error: {
        padding: '10px 14px',
        border: '1px solid var(--dsw-alias-state-error-primary)',
        borderRadius: '8px',
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: '12px',
        lineHeight: '18px',
      },
      notice: {
        padding: '10px 14px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '8px',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: '12px',
      },
    };

    // The shipped `trash-outline` glyph, copied verbatim from the frontend icon
    // sprite (`"trash-outline":{size:16,svg:e=>…}`). The `regular` variant draws
    // it with stroke-width 1; `._itemIcon` then sizes the svg to 14px. Because
    // stroke-width lives on the svg element the paths inherit it, exactly as the
    // sprite does — so this is the same drawing "删除工作区" uses, not a lookalike.
    const TRASH_PATHS = [
      'M1.28149 3.88831H14.7187',
      'M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833',
      'M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831',
      'M6.44946 6.98926V11.1238',
      'M9.55054 6.98926V11.1238',
    ];

    function TrashGlyph(props) {
      const size = props && typeof props.size === 'number' && props.size > 0 ? props.size : 14;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          strokeWidth: 1,
          'aria-hidden': true,
          style: { display: 'block' },
        },
        TRASH_PATHS.map((d, index) => h('path', { key: index, d, stroke: 'currentColor' })),
      );
    }

    /* -------------------------------------------------------------- */
    /* session menu row                                               */
    /* -------------------------------------------------------------- */

    function TrashMenuItem(props) {
      const [phase, setPhase] = React.useState('idle');
      const [hovered, setHovered] = React.useState(false);

      const run = React.useCallback(
        async (event) => {
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
          if (phase === 'busy' || phase === 'done') return;
          setPhase('busy');
          try {
            await post({ action: 'trash', sessionId: props.sessionId });
            setPhase('done');
          } catch (error) {
            setPhase('idle');
            console.error('[session-hygiene] trash failed', error);
          }
        },
        [phase, props.sessionId],
      );

      const label = phase === 'busy' ? t('menuTrashing') : t('menuTrash');
      const inactive = phase === 'busy' || phase === 'done';

      // `._danger_1p5el_250`: label and icon both take the error colour; only the
      // hover/focus background changes, to the dedicated danger token.
      const rowStyle = { ...S.menuItem, color: 'var(--dsw-alias-state-error-primary)' };
      if (inactive) rowStyle.opacity = 0.4;
      else if (hovered) rowStyle.background = 'var(--dsw-alias-interactive-bg-hover-danger)';

      const iconStyle = { ...S.menuItemIcon, color: 'var(--dsw-alias-state-error-primary)' };

      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          title: t('menuHint'),
          disabled: inactive,
          style: rowStyle,
          onClick: run,
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        },
        h('span', { style: iconStyle }, h(TrashGlyph)),
        h('span', { style: S.menuItemLabel }, label),
      );
    }

    /* -------------------------------------------------------------- */
    /* settings page                                                  */
    /* -------------------------------------------------------------- */

    function HygienePanel() {
      const [data, setData] = React.useState(null);
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [confirming, setConfirming] = React.useState('');
      const [tab, setTab] = React.useState('orphans');
      const [confirmBulk, setConfirmBulk] = React.useState(false);
      const [confirmPurgeAll, setConfirmPurgeAll] = React.useState(false);

      const load = React.useCallback(async () => {
        setError('');
        try {
          const result = await post({ action: 'scan' });
          setData(result);
        } catch (failure) {
          setError(t('actionFailed', { message: failure.message }));
        }
      }, []);

      React.useEffect(() => {
        load();
      }, [load]);

      const orphans = React.useMemo(() => {
        if (!data || !Array.isArray(data.sessions)) return [];
        return data.sessions.filter((item) => item.orphan);
      }, [data]);
      const trash = data && Array.isArray(data.trash) ? data.trash : [];

      // Sessions whose cwd resolves to a workspace that does not list them: the
      // sidebar files them under "未分组" even though the workspace exists.
      const detachedRows = React.useMemo(() => {
        if (!data || !Array.isArray(data.sessions)) return [];
        return data.sessions.filter((item) => item.detached);
      }, [data]);

      const run = React.useCallback(async (key, operation) => {
        if (busy) return;
        setBusy(key);
        setNotice('');
        setError('');
        try {
          const result = await operation();
          if (result) setNotice(result);
          await load();
        } catch (failure) {
          setError(t('actionFailed', { message: failure.message }));
        } finally {
          setBusy('');
          setConfirming('');
          setConfirmBulk(false);
          setConfirmPurgeAll(false);
        }
      }, [busy, load]);

      const archiveOrphans = () =>
        run('archive', async () => {
          const ids = orphans.filter((item) => !item.subagent).map((item) => item.sessionId);
          if (ids.length === 0) return '';
          const result = await post({ action: 'archive', sessionIds: ids });
          if (result.failed && result.failed.length > 0) {
            return t('archiveFailed', { count: result.failed.length });
          }
          return t('archiveDone', { count: result.archived });
        });

      // Bulk trash covers every orphan, subagents included: unlike archive, this
      // is the path that actually reclaims the orphan, and it is recoverable from
      // the trash tab.
      const trashAllOrphans = () =>
        run('trash-all', async () => {
          const ids = orphans.map((item) => item.sessionId);
          if (ids.length === 0) return '';
          const result = await post({ action: 'trash-all', sessionIds: ids });
          if (result.failed && result.failed.length > 0) {
            return t('trashFailed', { count: result.failed.length });
          }
          return t('trashDone', { count: result.trashed });
        });

      const reattachAll = () =>
        run('reattach', async () => {
          const ids = detachedRows.map((item) => item.sessionId);
          if (ids.length === 0) return '';
          const result = await post({ action: 'reattach', sessionIds: ids });
          if (result.failed && result.failed.length > 0) {
            return t('reattachFailed', { count: result.failed.length });
          }
          return t('reattachDone', { count: result.attached });
        });

      const trashOne = (sessionId) =>
        run('trash:' + sessionId, async () => {
          await post({ action: 'trash', sessionId });
          return '';
        });

      const restoreOne = (entryId) =>
        run('restore:' + entryId, async () => {
          await post({ action: 'restore', entryId });
          return '';
        });

      const purgeOne = (entryId) =>
        run('purge:' + entryId, async () => {
          await post({ action: 'purge', entryId });
          return '';
        });

      const restoreAllEntries = () =>
        run('restore-all', async () => {
          const ids = trash.map((entry) => entry.id);
          if (ids.length === 0) return '';
          const result = await post({ action: 'restore-all', entryIds: ids });
          if (result.failed && result.failed.length > 0) {
            return t('restoreFailed', { count: result.failed.length });
          }
          return t('restoreDone', { count: result.restored });
        });

      const purgeAllEntries = () =>
        run('purge-all', async () => {
          const ids = trash.map((entry) => entry.id);
          if (ids.length === 0) return '';
          const result = await post({ action: 'purge-all', entryIds: ids });
          if (result.failed && result.failed.length > 0) {
            return t('purgeFailed', { count: result.failed.length });
          }
          return t('purgeDone', { count: result.purged });
        });

      const tabButton = (key, label, count) =>
        h(
          'button',
          {
            key,
            type: 'button',
            role: 'tab',
            'aria-selected': tab === key,
            style: tab === key ? { ...S.tab, ...S.tabActive } : { ...S.tab },
            onClick: () => setTab(key),
          },
          label,
          h('span', { style: S.tabCount }, String(count)),
        );

      if (!data) {
        return h(
          'div',
          { style: S.page },
          h('div', { style: S.title }, t('title')),
          error
            ? h('div', { style: S.error }, error)
            : h('div', { style: S.loading }, t('loading')),
        );
      }

      // Bulk archive skips subagent sessions: archiving one that still has a live
      // parent would gate its next step. Say so in the button label by showing
      // the count this action actually covers.
      const archiveCandidates = orphans.filter((item) => !item.subagent);

      return h(
        'div',
        { style: S.page },
        h(
          'div',
          { style: S.headerRow },
          h(
            'div',
            null,
            h('h2', { style: S.title }, t('title')),
            h('p', { style: S.subtitle }, t('subtitle')),
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '8px', flexShrink: 0 } },
            h(
              'button',
              { type: 'button', style: S.button, onClick: load, disabled: Boolean(busy) },
              t('refresh'),
            ),
          ),
        ),

        error ? h('div', { style: S.error }, error) : null,
        notice ? h('div', { style: S.notice }, notice) : null,

        detachedRows.length > 0
          ? h(
              'div',
              { style: S.strip },
              h('span', { style: S.stripText }, t('detachedHint', { count: detachedRows.length })),
              h(
                'button',
                {
                  type: 'button',
                  style: S.button,
                  disabled: Boolean(busy),
                  onClick: reattachAll,
                },
                busy === 'reattach' ? '…' : t('reattachAll'),
              ),
            )
          : null,

        /* Two independent lists: orphans are "still here, decide", the trash is
           "already moved, restore or purge". Showing one at a time keeps the
           page short instead of stacking both. */
        h(
          'div',
          { style: S.tabs, role: 'tablist' },
          tabButton('orphans', t('sectionOrphans'), orphans.length),
          tabButton('trash', t('sectionTrash'), trash.length),
        ),

        tab === 'orphans'
          ? h(
          'div',
          { style: S.section },
          h(
            'div',
            { style: S.toolbar },
            h('p', { style: S.toolbarHint }, t('sectionOrphansHint')),
            h(
              'div',
              { style: S.toolbarActions },
              h(
                'button',
                {
                  type: 'button',
                  style: S.button,
                  disabled: archiveCandidates.length === 0 || Boolean(busy),
                  onClick: archiveOrphans,
                },
                t('archiveCount', { count: archiveCandidates.length }),
              ),
              confirmBulk
                ? h(
                    React.Fragment,
                    null,
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.buttonDanger,
                        disabled: orphans.length === 0 || Boolean(busy),
                        onClick: trashAllOrphans,
                      },
                      busy === 'trash-all'
                        ? '…'
                        : t('confirmTrashAll', { count: orphans.length }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.buttonQuiet,
                        onClick: () => setConfirmBulk(false),
                      },
                      t('cancel'),
                    ),
                  )
                : h(
                    'button',
                    {
                      type: 'button',
                      style: S.buttonDanger,
                      disabled: orphans.length === 0 || Boolean(busy),
                      onClick: () => setConfirmBulk(true),
                    },
                    t('trashAll'),
                  ),
            ),
          ),
          orphans.length === 0
            ? h('div', { style: S.empty }, t('emptyOrphans'))
            : orphans.map((item) =>
                h(
                  'div',
                  { key: item.sessionId, style: S.row },
                  h(
                    'div',
                    { style: S.rowMain },
                    h(
                      'div',
                      { style: S.rowTitle },
                      headingFor(item),
                      item.subagent ? h('span', { style: S.badge }, t('subagentSession')) : null,
                    ),
                    item.preview && item.preview !== headingFor(item)
                      ? h('div', { style: S.rowPreview, title: item.preview }, item.preview)
                      : null,
                    h(
                      'div',
                      { style: S.rowMeta },
                      (item.workspaceTitle || t('unknownWorkspace')) +
                        ' · ' +
                        basename(item.cwd || '') +
                        ' · ' +
                        formatBytes(item.sizeBytes),
                    ),
                  ),
                  h(
                    'div',
                    { style: S.actions },
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.buttonDanger,
                        disabled: Boolean(busy),
                        onClick: () => trashOne(item.sessionId),
                      },
                      busy === 'trash:' + item.sessionId ? '…' : t('moveToTrash'),
                    ),
                  ),
                ),
              ),
          )
          : h(
            'div',
          { style: S.section },
          h(
            'div',
            { style: S.toolbar },
            h('p', { style: S.toolbarHint }, t('sectionTrashHint')),
            h(
              'div',
              { style: S.toolbarActions },
              h(
                'button',
                {
                  type: 'button',
                  style: S.button,
                  disabled: trash.length === 0 || Boolean(busy),
                  onClick: restoreAllEntries,
                },
                busy === 'restore-all' ? '…' : t('restoreAll'),
              ),
              confirmPurgeAll
                ? h(
                    React.Fragment,
                    null,
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.buttonDanger,
                        disabled: trash.length === 0 || Boolean(busy),
                        onClick: purgeAllEntries,
                      },
                      busy === 'purge-all'
                        ? '…'
                        : t('confirmPurgeAll', { count: trash.length }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.buttonQuiet,
                        onClick: () => setConfirmPurgeAll(false),
                      },
                      t('cancel'),
                    ),
                  )
                : h(
                    'button',
                    {
                      type: 'button',
                      style: S.buttonDanger,
                      disabled: trash.length === 0 || Boolean(busy),
                      onClick: () => setConfirmPurgeAll(true),
                    },
                    t('purgeAll'),
                  ),
            ),
          ),
          trash.length === 0
            ? h('div', { style: S.empty }, t('emptyTrash'))
            : trash.map((entry) =>
                h(
                  'div',
                  { key: entry.id, style: S.row },
                  h(
                    'div',
                    { style: S.rowMain },
                    h('div', { style: S.rowTitle }, headingFor(entry)),
                    entry.preview && entry.preview !== headingFor(entry)
                      ? h('div', { style: S.rowPreview, title: entry.preview }, entry.preview)
                      : null,
                    h(
                      'div',
                      { style: S.rowMeta },
                      basename(entry.cwd || '') +
                        ' · ' +
                        formatBytes(entry.sizeBytes) +
                        ' · ' +
                        formatDate(entry.deletedAt),
                    ),
                  ),
                  h(
                    'div',
                    { style: S.actions },
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.button,
                        disabled: Boolean(busy),
                        onClick: () => restoreOne(entry.id),
                      },
                      t('restore'),
                    ),
                    confirming === entry.id
                      ? h(
                          React.Fragment,
                          null,
                          h(
                            'button',
                            {
                              type: 'button',
                              style: S.buttonDanger,
                              disabled: Boolean(busy),
                              onClick: () => purgeOne(entry.id),
                            },
                            t('confirmPurge'),
                          ),
                          h(
                            'button',
                            { type: 'button', style: S.buttonQuiet, onClick: () => setConfirming('') },
                            t('cancel'),
                          ),
                        )
                      : h(
                          'button',
                          {
                            type: 'button',
                            style: S.buttonQuiet,
                            disabled: Boolean(busy),
                            onClick: () => setConfirming(entry.id),
                          },
                          t('purge'),
                        ),
                  ),
                ),
              ),
        ),
      );
    }

    /* -------------------------------------------------------------- */
    /* workspace categories                                           */
    /* -------------------------------------------------------------- */

    // The shipped `folder-close` glyph, copied verbatim from the frontend icon
    // sprite. Used for the categories settings-nav entry so it matches the
    // folder the sidebar already draws for workspace rows.
    function FolderGlyph(props) {
      const size = props && typeof props.size === 'number' && props.size > 0 ? props.size : 16;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          strokeWidth: 1,
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', {
          d: 'M1.50439 3.11059C1.50439 2.55831 1.95211 2.1106 2.50439 2.1106H5.43389C5.67773 2.1106 5.91318 2.19969 6.09593 2.36113L7.71649 3.79265C7.89924 3.95409 8.1347 4.04319 8.3785 4.04319H13.4958C14.0481 4.04319 14.4958 4.4909 14.4958 5.04319V12.8894C14.4958 13.4417 14.0481 13.8894 13.4958 13.8894H2.50439C1.95211 13.8894 1.50439 13.4417 1.50439 12.8894V4.04319V3.11059Z',
          stroke: 'currentColor',
        }),
        h('path', { d: 'M3.63501 7.66614H12.3647', stroke: 'currentColor' }),
      );
    }

    // `chevron-down-outline` / `chevron-right-outline` from the same sprite. The
    // sidebar labels are plain DOM nodes, so the glyph is markup rather than JSX.
    const CHEVRON_PATHS = {
      down: 'M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6',
      up: 'M12 10L8.70711 6.70711C8.31658 6.31658 7.68342 6.31658 7.29289 6.70711L4 10',
      right: 'M6 12L9.29289 8.70711C9.68342 8.31658 9.68342 7.68342 9.29289 7.29289L6 4',
    };

    /** React form of the same sprite glyph, for in-page controls. */
    function ChevronIcon(props) {
      const direction = props && props.direction && CHEVRON_PATHS[props.direction] ? props.direction : 'down';
      const size = props && typeof props.size === 'number' && props.size > 0 ? props.size : 12;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          strokeWidth: 1,
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: CHEVRON_PATHS[direction], stroke: 'currentColor' }),
      );
    }

    const chevronMarkup = (direction) =>
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" ' +
      'fill="none" stroke-width="1" aria-hidden="true"><path d="' +
      CHEVRON_PATHS[direction] +
      '" stroke="currentColor"/></svg>';

    /** Hand-drawn stand-in, kept in the shell's stroke weight and 16-box grid. */
    const FOLDER_PLUS_MARKUP =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" ' +
      'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M1.9 4.3c0-.5.4-1 1-1h3l1.2 1.5h5.9c.5 0 1 .5 1 1v6.1c0 .5-.5 1-1 1H2.9' +
      'c-.6 0-1-.5-1-1z"/>' +
      '<path d="M11.6 8.9v3.4M9.9 10.6h3.4"/>' +
      '</svg>';

    // Cloned from the shell's own "new workspace" control so the band's button
    // matches the one above the workspace list; redrawing it would drift.
    let shellWorkspaceGlyph = null;

    const workspaceGlyphMarkup = () => {
      if (shellWorkspaceGlyph) return shellWorkspaceGlyph;
      for (const button of document.querySelectorAll(
        'button[aria-label], [role="button"][aria-label]',
      )) {
        const label = (button.getAttribute('aria-label') || '').toLowerCase();
        if (!/(workspace|工作区)/.test(label)) continue;
        if (!/(new|add|create|新建|添加|创建)/.test(label)) continue;
        const svg = button.querySelector('svg');
        if (!svg) continue;
        shellWorkspaceGlyph = svg.outerHTML;
        return shellWorkspaceGlyph;
      }
      return FOLDER_PLUS_MARKUP;
    };

    function CategoriesPanel() {
      const [state, setState] = React.useState(null);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [confirmClear, setConfirmClear] = React.useState(false);
      // Sidebar drags write assignments behind this panel's back; reload on those
      // notifications, but never over unsaved edits made here.
      const dirty = React.useRef(false);

      const load = React.useCallback(async () => {
        setError('');
        try {
          const result = await post({ action: 'categories' });
          setState({
            categories: Array.isArray(result.categories) ? result.categories.slice() : [],
            assignments: { ...(result.assignments || {}) },
            workspaces: Array.isArray(result.workspaces) ? result.workspaces : [],
            showHeaders: result.showHeaders !== false,
          });
          dirty.current = false;
        } catch (failure) {
          setError(t('actionFailed', { message: failure.message }));
        }
      }, []);

      React.useEffect(() => {
        load();
      }, [load]);

      React.useEffect(() => {
        const handler = () => {
          if (!dirty.current) load();
        };
        window.addEventListener('dsh-session-hygiene:categories', handler);
        return () => window.removeEventListener('dsh-session-hygiene:categories', handler);
      }, [load]);

      const addCategory = () => {
        dirty.current = true;
        setState((previous) => {
          if (!previous) return previous;
          const used = new Set(previous.categories.map((category) => category.id));
          let index = previous.categories.length + 1;
          let id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          while (used.has(id)) id = id + 'x';
          return {
            ...previous,
            categories: [...previous.categories, { id, name: t('newCategory') + ' ' + index }],
          };
        });
      };

      const renameCategory = (id, name) => {
        dirty.current = true;
        setState((previous) =>
          previous
            ? {
                ...previous,
                categories: previous.categories.map((category) =>
                  category.id === id ? { ...category, name } : category,
                ),
              }
            : previous,
        );
      };

      const removeCategory = (id) => {
        dirty.current = true;
        setState((previous) => {
          if (!previous) return previous;
          const assignments = { ...previous.assignments };
          for (const [workspaceId, categoryId] of Object.entries(assignments)) {
            if (categoryId === id) delete assignments[workspaceId];
          }
          return {
            ...previous,
            categories: previous.categories.filter((category) => category.id !== id),
            assignments,
          };
        });
      };

      const moveCategory = (id, delta) => {
        dirty.current = true;
        setState((previous) => {
          if (!previous) return previous;
          const index = previous.categories.findIndex((category) => category.id === id);
          const target = index + delta;
          if (index < 0 || target < 0 || target >= previous.categories.length) return previous;
          const categories = previous.categories.slice();
          const [moved] = categories.splice(index, 1);
          categories.splice(target, 0, moved);
          return { ...previous, categories };
        });
      };

      const assign = (workspaceId, categoryId) => {
        dirty.current = true;
        setState((previous) => {
          if (!previous) return previous;
          const assignments = { ...previous.assignments };
          if (categoryId) assignments[workspaceId] = categoryId;
          else delete assignments[workspaceId];
          return { ...previous, assignments };
        });
      };

      const save = async () => {
        if (!state || busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const result = await post({
            action: 'save-categories',
            categories: state.categories.map((category) => ({ id: category.id, name: category.name })),
            assignments: state.assignments,
            showHeaders: state.showHeaders !== false,
            cluster: true,
          });
          setNotice(t('clusteredDone', { count: Array.isArray(result.order) ? result.order.length : 0 }));
          try {
            window.dispatchEvent(new Event('dsh-session-hygiene:categories'));
          } catch {
            /* the sidebar repaints on its next own mutation */
          }
          await load();
        } catch (failure) {
          setError(t('actionFailed', { message: failure.message }));
        } finally {
          setBusy(false);
        }
      };

      const clearAssignments = async () => {
        if (!state || busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          await post({
            action: 'save-categories',
            categories: state.categories.map((category) => ({ id: category.id, name: category.name })),
            assignments: {},
            showHeaders: state.showHeaders !== false,
            cluster: false,
          });
          dirty.current = false;
          setNotice(t('clearedDone'));
          try {
            window.dispatchEvent(new Event('dsh-session-hygiene:categories'));
          } catch {
            /* the sidebar repaints on its next own mutation */
          }
          await load();
        } catch (failure) {
          setError(t('actionFailed', { message: failure.message }));
        } finally {
          setBusy(false);
          setConfirmClear(false);
        }
      };

      if (!state) {
        return h(
          'div',
          { style: S.page },
          h('div', { style: S.title }, t('categoriesTitle')),
          error ? h('div', { style: S.error }, error) : h('div', { style: S.loading }, t('loading')),
        );
      }

      const categoryOptions = state.categories;

      return h(
        'div',
        { style: S.page },
        h(
          'div',
          { style: S.headerRow },
          h(
            'div',
            null,
            h('h2', { style: S.title }, t('categoriesTitle')),
            h('p', { style: S.subtitle }, t('categoriesSubtitle')),
          ),
          h(
            'button',
            { type: 'button', style: S.button, onClick: save, disabled: busy },
            busy ? '…' : t('saveAndCluster'),
          ),
        ),

        error ? h('div', { style: S.error }, error) : null,
        notice ? h('div', { style: S.notice }, notice) : null,

        h(
          'div',
          { style: S.section },
          h(
            'div',
            { style: S.toolbar },
            h(
              'p',
              { style: S.toolbarHint },
              categoryOptions.length === 0 ? t('noCategories') : t('categoriesHint'),
            ),
            h(
              'div',
              { style: S.toolbarActions },
              h(
                'button',
                { type: 'button', style: S.button, onClick: addCategory },
                t('addCategory'),
              ),
              confirmClear
                ? h(
                    React.Fragment,
                    null,
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.buttonDanger,
                        onClick: clearAssignments,
                        disabled: busy,
                      },
                      t('confirmClear'),
                    ),
                    h(
                      'button',
                      { type: 'button', style: S.buttonQuiet, onClick: () => setConfirmClear(false) },
                      t('cancel'),
                    ),
                  )
                : h(
                    'button',
                    {
                      type: 'button',
                      style: S.buttonQuiet,
                      onClick: () => setConfirmClear(true),
                      disabled: busy,
                    },
                    t('clearAssignments'),
                  ),
            ),
          ),
          categoryOptions.length === 0
            ? null
            : categoryOptions.map((category, index) =>
                h(
                  'div',
                  { key: category.id, style: S.row },
                  h(
                    'input',
                    {
                      style: S.input,
                      value: category.name,
                      onChange: (event) => renameCategory(category.id, event.target.value),
                      'aria-label': t('categoryName'),
                    },
                  ),
                  h(
                    'div',
                    { style: S.actions },
                    h(
                      'button',
                      {
                        type: 'button',
                        style: index === 0 ? { ...S.iconButton, opacity: 0.4 } : S.iconButton,
                        disabled: index === 0,
                        title: t('moveUp'),
                        'aria-label': t('moveUp'),
                        onClick: () => moveCategory(category.id, -1),
                      },
                      h(ChevronIcon, { direction: 'up' }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style:
                          index === categoryOptions.length - 1
                            ? { ...S.iconButton, opacity: 0.4 }
                            : S.iconButton,
                        disabled: index === categoryOptions.length - 1,
                        title: t('moveDown'),
                        'aria-label': t('moveDown'),
                        onClick: () => moveCategory(category.id, 1),
                      },
                      h(ChevronIcon, { direction: 'down' }),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        style: S.buttonQuiet,
                        onClick: () => removeCategory(category.id),
                      },
                      t('deleteCategory'),
                    ),
                  ),
                ),
              ),
          h(
            'div',
            { style: S.row },
            h(
              'label',
              { style: S.checkboxRow },
              h('input', {
                type: 'checkbox',
                checked: state.showHeaders !== false,
                onChange: (event) =>
                  setState((previous) =>
                    previous ? { ...previous, showHeaders: event.target.checked } : previous,
                  ),
              }),
              h('span', null, t('showHeaders')),
            ),
          ),
        ),

        h(
          'div',
          { style: S.section },
          h(
            'div',
            { style: S.toolbar },
            h('p', { style: S.toolbarHint }, t('assignHint')),
          ),
          state.workspaces.map((workspace) =>
            h(
              'div',
              { key: workspace.id, style: S.row },
              h(
                'div',
                { style: S.rowMain },
                h('div', { style: S.rowTitle }, workspace.title || workspace.id),
                h('div', { style: S.rowMeta }, workspace.path || ''),
              ),
              h(
                'div',
                { style: S.actions },
                h(
                  'select',
                  {
                    style: S.select,
                    value: state.assignments[workspace.id] || '',
                    onChange: (event) => assign(workspace.id, event.target.value),
                    'aria-label': t('categoryName'),
                  },
                  h('option', { value: '' }, t('uncategorized')),
                  categoryOptions.map((category) =>
                    h('option', { key: category.id, value: category.id }, category.name),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    /* -------------------------------------------------------------- */
    /* sidebar category labels — the only DOM-side contribution        */
    /* -------------------------------------------------------------- */

    const LABEL_ATTR = 'data-session-hygiene-label';
    const LABEL_TEXT_ATTR = 'data-session-hygiene-label-text';

    /**
     * `sidebar.workspaces` is a single slot owned by the shell, so a category
     * band cannot be contributed through slots. This mounts nothing, watches the
     * workspace rows the shell renders, and inserts one label element above each
     * category that is currently one contiguous block — a category whose rows are
     * split shows no header rather than a header over the wrong rows. It only
     * ever adds and removes its own nodes; no host row is moved or rewritten, and
     * removing the plugin (or turning the toggle off) restores the list exactly.
     */
    function SidebarGroupLabels() {
      React.useEffect(() => {
        let state = { categories: [], assignments: {}, collapsed: {}, showHeaders: true };
        // Last laid-out row geometry and time-label column. Rows report a zero
        // box while hidden — every row hides once all categories collapse — so
        // the last good measurement is reused instead of shrinking to nothing.
        let lastRowBox = null;
        let lastColumnRight = null;
        let signature = '';
        let timer = 0;
        let disposed = false;

        // Rows we hid for a collapsed category, with the display value to put back.
        const hidden = new Map();

        // Rows under a category band sit one step right of it, so the band reads
        // as their heading instead of a sibling. Only rows of a category that
        // actually drew a band shift: a split category has none to sit under.
        const INDENT_PX = 12;
        const indented = new Map();

        const indent = (element) => {
          const known = indented.get(element);
          if (known) {
            // A re-render can drop the inline value we set; put it back.
            if (!element.style.paddingLeft) {
              element.style.paddingLeft = known.base + INDENT_PX + 'px';
            }
            return;
          }
          const base = Number.parseFloat(window.getComputedStyle(element).paddingLeft) || 0;
          indented.set(element, { base, inline: element.style.paddingLeft });
          element.style.paddingLeft = base + INDENT_PX + 'px';
        };

        const restore = () => {
          for (const [element, value] of hidden) element.style.display = value;
          hidden.clear();
          for (const [element, known] of indented) element.style.paddingLeft = known.inline;
          indented.clear();
        };

        const conceal = (element) => {
          if (hidden.has(element)) return;
          hidden.set(element, element.style.display);
          element.style.display = 'none';
        };

        // Header elements are reused across repaints: tearing them down and
        // rebuilding the whole band on every mutation is what made the sidebar
        // blink during a drag.
        const mounted = new Map();

        const clear = () => {
          for (const node of mounted.values()) node.remove();
          mounted.clear();
          for (const node of document.querySelectorAll('[' + LABEL_ATTR + ']')) node.remove();
          // A bubble that is open when its band goes away would otherwise stay.
          for (const node of document.querySelectorAll('[data-session-hygiene-bubble]')) node.remove();
        };

        /** Persist a drop: the workspace joins the category, then the list regroups. */
        const joinCategory = (workspaceId, categoryId) => {
          const assignments = { ...(state.assignments || {}) };
          if ((assignments[workspaceId] || '') === categoryId) return;
          assignments[workspaceId] = categoryId;
          state = { ...state, assignments };
          signature = '';
          post({
            action: 'save-categories',
            categories: state.categories.map((category) => ({ id: category.id, name: category.name })),
            assignments,
            showHeaders: state.showHeaders !== false,
            cluster: true,
          }).catch(() => {});
        };

        // The host owns the native directory dialog, so one request covers pick,
        // create and filing. Guarded because the dialog stays open for a while.
        let creating = false;
        const createWorkspaceInCategory = (categoryId) => {
          if (creating) return;
          creating = true;
          post({ action: 'create-workspace', categoryId })
            .then((result) => {
              if (!result || result.cancelled) return;
              // The registry adds the row; this event re-reads the assignment so
              // the new row lands indented under its band.
              window.dispatchEvent(new Event('dsh-session-hygiene:categories'));
            })
            .catch((error) => {
              console.error('[session-hygiene] create workspace failed', error);
            })
            .finally(() => {
              creating = false;
            });
        };

        /**
         * A header is a real drop target, so joining a category is an explicit
         * drop ON that category rather than a guess about where a row landed.
         * Only workspace drags are accepted, the drop does not bubble, and the
         * shell's own row-level dragover/drop handlers are never touched — the
         * shipped reordering keeps working exactly as before.
         */
        const attachDropTarget = (holder, categoryId) => {
          const highlight = (on) => {
            holder.style.background = on ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent';
            holder.style.borderRadius = on ? '6px' : '0';
          };
          holder.addEventListener('dragover', (event) => {
            if (!draggedWorkspace) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
            highlight(true);
          });
          holder.addEventListener('dragleave', () => highlight(false));
          holder.addEventListener('drop', (event) => {
            if (!draggedWorkspace) return;
            event.preventDefault();
            event.stopPropagation();
            highlight(false);
            // The row never moved, so dragend must not re-derive its category.
            dropHandled = true;
            joinCategory(draggedWorkspace, categoryId);
          });
        };

        /**
         * Where a band must live: the anchor's own wrapper chain is not a list.
         * A workspace row sits inside a single-child wrapper (and that inside a
         * group section), so inserting beside the row puts the band INSIDE the
         * workspace's hover subtree — entering the band opens that workspace's
         * hover card. Climb past every wrapper that holds only one child, and
         * insert into the first container that actually holds siblings.
         */
        const bandPlacement = (anchor) => {
          let node = anchor;
          let parent = node.parentElement;
          while (parent && parent !== document.body) {
            const owned = [...parent.children].filter((child) => !child.hasAttribute(LABEL_ATTR));
            if (owned.length > 1) break;
            node = parent;
            parent = parent.parentElement;
          }
          return { list: parent ?? anchor.parentElement, before: node };
        };

        /** Builds one header node; listeners are bound once, not on every paint. */
        const createHeader = (categoryId) => {
          // A div carrying the button role: the "+" control is a real button and
          // one button may not nest inside another.
          const holder = document.createElement('div');
          holder.setAttribute('role', 'button');
          holder.setAttribute('tabindex', '0');
          holder.setAttribute(LABEL_ATTR, '1');
          holder.setAttribute('data-category', categoryId);
          holder.style.cssText =
            'display:flex;align-items:center;gap:5px;box-sizing:border-box;' +
            'padding:10px 18px 3px 10px;border:0;background:transparent;cursor:pointer;' +
            'text-align:left;font-size:12px;line-height:18px;font-weight:600;' +
            'letter-spacing:.01em;color:var(--dsw-alias-label-tertiary);user-select:none;';
          const chevron = document.createElement('span');
          chevron.style.cssText = 'flex:none;display:inline-flex;align-items:center;';
          const text = document.createElement('span');
          text.setAttribute(LABEL_TEXT_ATTR, '1');
          text.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          const addButton = document.createElement('button');
          addButton.type = 'button';
          addButton.setAttribute('aria-label', t('addWorkspaceHere'));
          addButton.style.cssText =
            'flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;' +
            'width:20px;height:20px;padding:0;border:0;border-radius:4px;background:transparent;' +
            'color:inherit;cursor:pointer;opacity:.7;transition:background .12s ease,opacity .12s ease;';
          // The shell draws its own tooltips as a dark bubble; a native `title`
          // would show the browser's grey one beside it. This is that bubble,
          // built here because a plain DOM node cannot reach the shell's tooltip
          // component — same shape, same text, no shortcut hint.
          const bubble = document.createElement('div');
          bubble.textContent = t('addWorkspaceHere');
          bubble.setAttribute('data-session-hygiene-bubble', '1');
          bubble.style.cssText =
            'position:fixed;z-index:2147483000;pointer-events:none;visibility:hidden;opacity:0;' +
            'transition:opacity .12s ease;padding:5px 9px;border-radius:6px;background:#1f2328;' +
            'color:#fff;font-size:12px;line-height:16px;font-weight:500;white-space:nowrap;' +
            'letter-spacing:0;box-shadow:0 6px 16px rgba(0,0,0,.22);';
          const hideBubble = () => {
            bubble.style.opacity = '0';
            bubble.style.visibility = 'hidden';
            bubble.remove();
          };
          const showBubble = () => {
            const rect = addButton.getBoundingClientRect();
            document.body.appendChild(bubble);
            bubble.style.visibility = 'visible';
            bubble.style.left = Math.round(rect.left) + 'px';
            bubble.style.top = Math.round(rect.bottom + 6) + 'px';
            bubble.style.opacity = '1';
            // Flip above when the button sits near the bottom edge.
            const box = bubble.getBoundingClientRect();
            if (box.bottom > window.innerHeight - 8) {
              bubble.style.top = Math.round(rect.top - box.height - 6) + 'px';
            }
          };
          // Inline styles cannot express :hover, so the affordance is toggled by
          // hand with the theme's own interactive background token.
          addButton.addEventListener('mouseenter', () => {
            addButton.style.background = 'var(--dsw-alias-interactive-bg-hover)';
            addButton.style.opacity = '1';
            showBubble();
          });
          addButton.addEventListener('mouseleave', () => {
            addButton.style.background = 'transparent';
            addButton.style.opacity = '.7';
            hideBubble();
          });
          // Mirror the shell's own "new workspace" control: clone its glyph and
          // normalise the box, since the original may be sized by a class.
          addButton.innerHTML = workspaceGlyphMarkup();
          const glyph = addButton.querySelector('svg');
          if (glyph) {
            glyph.removeAttribute('class');
            glyph.setAttribute('width', '14');
            glyph.setAttribute('height', '14');
            glyph.setAttribute('aria-hidden', 'true');
          }
          addButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            hideBubble();
            createWorkspaceInCategory(categoryId);
          });
          holder.appendChild(chevron);
          holder.appendChild(text);
          holder.appendChild(addButton);
          holder.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggle(holder.getAttribute('data-category') || '');
          });
          // The shell opens a row's hover card from pointer moves it reads at the
          // list — or at a root above it — so a bubble listener on this band
          // cannot stop it. The guard below intercepts those moves at the
          // document's capture phase instead; it is registered once by the
          // effect, not per band.
          holder.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggle(holder.getAttribute('data-category') || '');
          });
          attachDropTarget(holder, categoryId);
          return holder;
        };

        /** Projects the current label and collapse state into an existing node. */
        const updateHeader = (holder, label, isCollapsed) => {
          holder.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
          const chevron = holder.firstElementChild;
          if (chevron) {
            const direction = isCollapsed ? 'right' : 'down';
            if (chevron.getAttribute('data-dir') !== direction) {
              chevron.setAttribute('data-dir', direction);
              chevron.innerHTML = chevronMarkup(direction);
            }
          }
          const text = holder.querySelector('[' + LABEL_TEXT_ATTR + ']');
          if (text && text.textContent !== label) text.textContent = label;
        };

        const computeSignature = (rows) =>
          rows.map((row) => row.getAttribute('data-row-key')).join('|') +
          '#' +
          JSON.stringify(state.assignments) +
          '#' +
          JSON.stringify(state.collapsed || {}) +
          '#' +
          String(state.showHeaders) +
          '#' +
          document.querySelectorAll('[' + LABEL_ATTR + ']').length;

        const toggle = (categoryId) => {
          const collapsed = { ...(state.collapsed || {}) };
          const next = collapsed[categoryId] !== true;
          if (next) collapsed[categoryId] = true;
          else delete collapsed[categoryId];
          state = { ...state, collapsed };
          signature = '';
          paint();
          // Persist; a failed write only costs the state after a reload.
          post({ action: 'toggle-category', categoryId, collapsed: next }).catch(() => {});
        };

        const paint = () => {
          if (disposed || dragging) return;
          // Every row counts, not just the workspaces: a group that grows past
          // the shell's watermark mounts an `overflow:` row, and a session that
          // arrives while its category is collapsed mounts a session row that
          // must be hidden on the spot. Keying the signature on workspace rows
          // alone made both of those mount changes invisible to this repaint.
          const rows = Array.from(document.querySelectorAll('[data-row-key]'));
          if (computeSignature(rows) === signature) return;
          const workspaceRows = rows.filter((row) => (row.getAttribute('data-row-key') || '').startsWith('workspace:'));

          restore();

          // Measure while the rows are laid out: restore() just undid the
          // collapse hiding, so this is the one moment geometry is readable even
          // when every category is collapsed. Hidden rows report a zero box, and
          // copying that would shrink a band until its label disappeared.
          const laidOut = (element) => element.getBoundingClientRect().width > 0;
          const sessionRow =
            [...document.querySelectorAll('[data-row-key^="session:"]')].find(laidOut) || null;
          const referenceRow = sessionRow || workspaceRows.find(laidOut) || null;
          if (referenceRow) {
            const rowRect = referenceRow.getBoundingClientRect();
            lastRowBox = { left: rowRect.left, width: rowRect.width };
            const edges = [];
            for (const element of referenceRow.querySelectorAll('*')) {
              if (element.childElementCount > 0) continue;
              const text = element.textContent;
              if (!text || text.trim() === '') continue;
              const rect = element.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) edges.push(rect.right);
            }
            if (edges.length > 0) lastColumnRight = Math.max(...edges);
          }

          if (!state.showHeaders || state.categories.length === 0) {
            // Header bands are nodes this component mounts; turning the toggle
            // off has to take them down. Leaving them would also strand them:
            // with no repaint the click still posts a toggle but nothing moves.
            clear();
            signature = computeSignature(rows);
            return;
          }

          const names = new Map(state.categories.map((category) => [category.id, category.name]));
          const collapsed = state.collapsed || {};

          // A collapsed category hides its workspace rows, the session rows
          // that follow each of them, and the "show N more sessions" row that
          // ends a long group, up to the next workspace row. That overflow row
          // is a row of the SHELL's list too (`overflow:<group>`), so it has to
          // be named here: leaving it behind strands a lone button under the
          // band, which reads as a broken group rather than a collapsed one.
          let owning = '';
          for (const row of document.querySelectorAll('[data-row-key]')) {
            const key = row.getAttribute('data-row-key') || '';
            if (key.startsWith('workspace:')) {
              owning = state.assignments[key.slice('workspace:'.length)] || '';
              if (owning && collapsed[owning]) conceal(row);
            } else if (key.startsWith('session:')) {
              if (owning && collapsed[owning]) conceal(row);
            } else if (key.startsWith('overflow:')) {
              // The row carries its own workspace, so read it from the key
              // instead of trusting the running `owning`.
              const owner = state.assignments[key.slice('overflow:'.length)] || '';
              if (owner && collapsed[owner]) conceal(row);
            }
          }

          // A header is honest only when a category's rows form ONE contiguous
          // block: the header anchors to the category's first row, so a split
          // category would label rows that belong elsewhere. Draw a header only
          // at the start of a single, unbroken run.
          const positions = new Map();
          workspaceRows.forEach((row, index) => {
            const key = row.getAttribute('data-row-key') || '';
            const categoryId = state.assignments[key.slice('workspace:'.length)] || '';
            if (!categoryId || !names.has(categoryId)) return;
            if (!positions.has(categoryId)) positions.set(categoryId, []);
            positions.get(categoryId).push(index);
          });

          const headerSlots = [];
          for (const [categoryId, indexes] of positions) {
            const first = indexes[0];
            const contiguous = indexes.every((value, offset) => value === first + offset);
            if (contiguous) headerSlots.push([first, categoryId]);
          }
          headerSlots.sort((a, b) => a[0] - b[0]);

          const desired = new Map();
          for (const [slotIndex, categoryId] of headerSlots) {
            desired.set(categoryId, workspaceRows[slotIndex]);
          }

          // Retire headers for categories that vanished or stopped being one run.
          for (const [categoryId, header] of [...mounted]) {
            if (desired.has(categoryId)) continue;
            header.remove();
            mounted.delete(categoryId);
          }

          // Reuse, update in place, and move only when the anchor changed.
          for (const [categoryId, anchor] of desired) {
            let header = mounted.get(categoryId);
            if (!header) {
              header = createHeader(categoryId);
              mounted.set(categoryId, header);
            }
            updateHeader(header, names.get(categoryId) || '', collapsed[categoryId] === true);
            const placement = bandPlacement(anchor);
            if (placement.list && (header.parentElement !== placement.list || header.nextElementSibling !== placement.before)) {
              placement.list.insertBefore(header, placement.before);
            }
          }

          // Shift every row that belongs to a banded category — the sessions
          // under each workspace included — so the band reads as their heading.
          // Rows of a category without a band stay flush, or the extra gap would
          // label nothing.
          const banded = new Set(desired.keys());
          let governed = '';
          for (const row of document.querySelectorAll('[data-row-key]')) {
            const key = row.getAttribute('data-row-key') || '';
            if (key.startsWith('workspace:')) {
              governed = state.assignments[key.slice('workspace:'.length)] || '';
            }
            if (governed !== '' && banded.has(governed)) indent(row);
          }

          // A band heads the rows below it, so it may not be wider than they are:
          // the shell insets each row, and the band copies the inset and width
          // measured above instead of spanning the whole list (where a scrollbar
          // would clip it).
          if (lastRowBox) {
            for (const header of mounted.values()) {
              const rect = header.getBoundingClientRect();
              const currentMargin = Number.parseFloat(header.style.marginLeft) || 0;
              const naturalLeft = rect.left - currentMargin;
              header.style.marginLeft = Math.max(0, lastRowBox.left - naturalLeft) + 'px';
              header.style.width = lastRowBox.width + 'px';
            }
          }

          // Park each band's "+" on the column measured above: the session rows'
          // own right inset belongs to the shell, so it is copied rather than
          // guessed.
          const column = lastColumnRight;
          if (column !== null) {
            for (const header of mounted.values()) {
              // The 12px glyph is centred in a 20px hit box, so its right edge
              // sits 4px inside the box's; that offset is what lands the mark
              // on the label's column rather than past it.
              const pad = Math.max(header.getBoundingClientRect().right - column - 4, 8);
              if (Number.isFinite(pad) && pad >= 0 && pad <= 120) {
                header.style.paddingRight = Math.round(pad) + 'px';
              }
            }
          }

          signature = computeSignature(rows);
        };

        const schedule = () => {
          if (timer || disposed || dragging) return;
          timer = setTimeout(() => {
            timer = 0;
            paint();
          }, 80);
        };

        /**
         * Where did the dragged row land? Only its previous sibling matters: a
         * header names the category, a workspace row inherits that row's
         * category, and running off the top means "unassigned".
         *
         * Scanning the whole document instead — the previous approach — reads
         * whichever header happens to precede it, and headers are anchored to
         * each category's *first* row. Once rows are scattered that is a
         * neighbouring category's header, which is how the wrong row looked
         * reassigned.
         */
        // While a drag is in flight the shell mounts its own preview node, which
        // our observer would read as "rows changed". Repainting then deletes and
        // re-inserts the headers under the pointer and the drag is dropped — so
        // the whole repaint pipeline is frozen for the duration.
        let dragging = false;
        // The workspace being dragged, so a header or a neighbouring block can
        // accept the drop.
        let draggedWorkspace = '';
        // Its category when the drag started; a drop inside the same block is a
        // pure reorder and must not touch the data.
        let draggedFrom = '';
        // A header consumed the drop, so the row never moved.
        let dropHandled = false;

        /**
         * Which block does this workspace row sit in?
         *
         * The list is sectioned: a workspace row is the first child of its own
         * section, so walking `previousElementSibling` finds nothing and every
         * drop used to read as "unassigned". Work on DOCUMENT order instead,
         * across sections, and consider our headers too — a header is the only
         * reliable "this is the first row of its block" marker. Without it, a
         * category holding a single row reads as a boundary between two others.
         */
        const categoryAtRow = (workspaceId) => {
          const escaped = String(workspaceId).replace(/["\\]/g, '\\$&');
          const row = document.querySelector('[data-row-key="workspace:' + escaped + '"]');
          if (!row) return null;
          const nodes = Array.from(
            document.querySelectorAll('[data-row-key^="workspace:"], [' + LABEL_ATTR + ']'),
          );
          const index = nodes.indexOf(row);
          if (index < 0) return null;

          const categoryOfRow = (element) => {
            const key = element.getAttribute('data-row-key') || '';
            const id = key.slice('workspace:'.length);
            if (!id) return '';
            return state.assignments[id] || '';
          };

          // Nearest thing above: a header is definitive, a row gives its block.
          let above = null;
          for (let i = index - 1; i >= 0; i -= 1) {
            const node = nodes[i];
            if (node.hasAttribute(LABEL_ATTR)) {
              return node.getAttribute('data-category') || '';
            }
            above = categoryOfRow(node);
            break;
          }

          // The row below decides a boundary: its top half is where we dropped.
          let below = '';
          let hasBelow = false;
          for (let i = index + 1; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.hasAttribute(LABEL_ATTR)) continue;
            below = categoryOfRow(node);
            hasBelow = Boolean((node.getAttribute('data-row-key') || '').slice('workspace:'.length));
            break;
          }

          if (above === null) return below;
          if (hasBelow && below !== above) return below;
          return above;
        };

        const onDragStart = (event) => {
          dragging = true;
          draggedWorkspace = '';
          draggedFrom = '';
          dropHandled = false;
          const target = event.target;
          if (target && typeof target.closest === 'function') {
            const row = target.closest('[data-row-key^="workspace:"]');
            if (row) {
              draggedWorkspace = (row.getAttribute('data-row-key') || '').slice('workspace:'.length);
              draggedFrom = state.assignments[draggedWorkspace] || '';
            }
          }
        };

        /**
         * Wait for the shell to actually move the row, then read its block.
         *
         * `insertBefore` is a Remote call: the drop round-trips to the host and
         * comes back through the workspace feed, so a fixed delay is a guess that
         * loses under load. Poll instead, and give up without touching anything:
         * regrouping on a timeout is what used to snap the row back to its old
         * category right after the user moved it.
         */
        const settleDrop = (workspaceId, from) => {
          if (disposed || !workspaceId) return;
          if (state.categories.length === 0) return;
          const deadline = Date.now() + 2500;

          const tick = () => {
            if (disposed) return;
            const target = categoryAtRow(workspaceId);
            if (target !== null && target !== from) {
              const assignments = { ...(state.assignments || {}) };
              if (target) assignments[workspaceId] = target;
              else delete assignments[workspaceId];
              state = { ...state, assignments };
              // Do not paint the provisional state: the regroup that follows
              // re-renders the list anyway, and painting twice makes the band hop.
              schedule();
              post({
                action: 'save-categories',
                categories: state.categories.map((category) => ({ id: category.id, name: category.name })),
                assignments,
                showHeaders: state.showHeaders !== false,
                cluster: true,
              }).catch(() => {});
              return;
            }
            // Same block (a plain reorder) or the drop was refused: leave both the
            // data and the order alone.
            if (Date.now() < deadline) setTimeout(tick, 120);
          };

          setTimeout(tick, 120);
        };

        const onDragEnd = () => {
          const workspaceId = draggedWorkspace;
          const from = draggedFrom;
          const consumed = dropHandled;
          dragging = false;
          draggedWorkspace = '';
          draggedFrom = '';
          dropHandled = false;
          signature = '';
          schedule();

          // A header already applied this drop; the row did not move.
          if (consumed || !workspaceId) return;
          settleDrop(workspaceId, from);
        };
        document.addEventListener('dragstart', onDragStart, true);
        document.addEventListener('dragend', onDragEnd, true);

        // Only react when rows or our own labels changed; chat streaming and
        // token updates would otherwise schedule a repaint on every chunk.
        const relevant = (node) => {
          if (!node || node.nodeType !== 1) return false;
          if (node.hasAttribute && (node.hasAttribute('data-row-key') || node.hasAttribute(LABEL_ATTR))) {
            return true;
          }
          return typeof node.querySelector === 'function'
            ? Boolean(node.querySelector('[data-row-key]'))
            : false;
        };

        /**
         * Dress rows the moment they mount.
         *
         * The debounced paint lands ~80ms after a row appears — long enough for
         * the browser to paint the freshly opened group's rows flush with their
         * band, so a running session's status dot visibly jumps to the band's
         * edge and only then slides right. MutationObserver callbacks run before
         * the next paint, so writing the same display/padding here closes that
         * window; the scheduled paint still owns the measuring and the bands.
         */
        const dress = (nodes) => {
          if (!state.showHeaders || state.categories.length === 0) return;
          const fresh = new Set();
          for (const node of nodes) {
            if (!node || node.nodeType !== 1) continue;
            if (node.hasAttribute('data-row-key')) fresh.add(node);
            else if (typeof node.querySelector === 'function') {
              for (const row of node.querySelectorAll('[data-row-key]')) fresh.add(row);
            }
          }
          if (fresh.size === 0) return;

          const collapsed = state.collapsed || {};
          // One document-order pass, exactly like paint(): a session row belongs
          // to the workspace row above it, while an overflow row names its own.
          let owning = '';
          for (const row of document.querySelectorAll('[data-row-key]')) {
            const key = row.getAttribute('data-row-key') || '';
            if (key.startsWith('workspace:')) {
              owning = state.assignments[key.slice('workspace:'.length)] || '';
            }
            if (!fresh.has(row)) continue;
            const category = key.startsWith('overflow:')
              ? state.assignments[key.slice('overflow:'.length)] || ''
              : owning;
            if (!category) continue;
            if (collapsed[category]) conceal(row);
            // Only a category that actually drew a band indents its rows.
            else if (mounted.has(category)) indent(row);
          }
        };

        const refresh = async () => {
          try {
            const result = await post({ action: 'categories' });
            state = {
              categories: Array.isArray(result.categories) ? result.categories : [],
              assignments: result.assignments || {},
              collapsed: result.collapsed || {},
              showHeaders: result.showHeaders !== false,
            };
            signature = '';
            paint();
          } catch (error) {
            /* an unreachable host just leaves the list unlabelled */
          }
        };

        const observer = new MutationObserver((records) => {
          if (dragging) return;
          let changed = false;
          const fresh = [];
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (!relevant(node)) continue;
              changed = true;
              fresh.push(node);
            }
            for (const node of record.removedNodes) if (relevant(node)) changed = true;
          }
          if (!changed) return;
          // New rows must be dressed before this frame paints; the debounced
          // paint that follows rebuilds bands and re-measures the list.
          dress(fresh);
          schedule();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener('dsh-session-hygiene:categories', refresh);
        refresh();

        return () => {
          disposed = true;
          observer.disconnect();
          if (timer) clearTimeout(timer);
          window.removeEventListener('dsh-session-hygiene:categories', refresh);
          document.removeEventListener('dragstart', onDragStart, true);
          document.removeEventListener('dragend', onDragEnd, true);
          clear();
          restore();
        };
      }, []);

      return null;
    }

    /* -------------------------------------------------------------- */

    return {
      inject: ['slots'],
      apply(ctx) {
        resolveDictionary(ctx);
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'session-hygiene-labels',
              order: 0,
            },
            SidebarGroupLabels,
          ),
        );
        ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
          ctx.slots.register(
            {
              name: 'sidebar.workspaces.session.menu.item',
              id: 'session-hygiene-trash',
              // Slot entries always render before the built-in Archive row; a high
              // order keeps this one directly above it instead of in the middle.
              order: 900,
              label: () => t('menuTrash'),
            },
            TrashMenuItem,
          ),
        );
        // The settings nav keeps its default gear unless an icon is registered
        // under the section's exact id. TrashGlyph reads `size` from the owner
        // props and draws in `currentColor`, so it follows the row's
        // active/inactive colour like every shipped nav glyph.
        ctx.slots.inject('settings.section.icon', () =>
          ctx.slots.register(
            {
              name: 'settings.section.icon',
              id: 'session-hygiene',
              order: 60,
            },
            TrashGlyph,
          ),
        );
        ctx.slots.inject('settings.section.icon', () =>
          ctx.slots.register(
            {
              name: 'settings.section.icon',
              id: 'workspace-categories',
              order: 61,
            },
            FolderGlyph,
          ),
        );
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'workspace-categories',
              order: 61,
              label: () => t('categoriesNav'),
            },
            CategoriesPanel,
          ),
        );
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'session-hygiene',
              order: 60,
              label: () => t('nav'),
            },
            HygienePanel,
          ),
        );
      },
    };
  },
});
