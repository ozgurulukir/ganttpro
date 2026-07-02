# TODO — GanttPro i18next

## Goal

Replace hardcoded English strings with i18next `t()` calls. Ship with English + Traditional Chinese.
The app currently has ~150 string-assignment sites across 16 JS files + ~25 static strings in index.html.

## Design decisions

### Why i18next over DIY

- Industry standard (~40KB min, framework-agnostic core).
- ICU message format: interpolation (`{{var}}`), plurals, nesting, context.
- Lazy loading of locale JSONs (future-proof for >3 locales).
- Community ecosystem: i18next-scanner for key extraction, VS Code extensions.
- YAGNI trade-off accepted: the 40KB cost buys a battle-tested plural/interpolation
  engine that avoids reinventing edge cases.

### Locale file structure

```
src/i18n/
  index.js           # init i18next, export t()
  locales/
    en.json           # English (default, ~300 keys)
    zh-TW.json        # Traditional Chinese (~300 keys)
```

Keys use dot-separated namespacing: `modal.editTask`, `tooltip.start`, `common.save`.

### Dynamic strings

i18next interpolation: `t('workload.active', { count: 5 })` → `"5 active"`.
Template: `"{{count}} active"` in JSON.

### Locale switching

- UI: small language dropdown in the toolbar (near dark mode button).
- Persist: `localStorage.setItem('ganttpro-locale', 'zh-TW')`.
- On load: read localStorage → fallback to `'en'`.
- Switching: call `i18next.changeLanguage(code)` → re-render entire UI.

### Re-render on locale change

Since the app uses direct DOM manipulation (no virtual DOM), locale switch triggers:
1. `render()` (full task panel + chart redraw — already exists).
2. Re-set all `title`/`placeholder` attributes on static HTML elements.
3. Re-render modal content if open.

A `setLocale()` wrapper handles this.

### index.html static strings

Two approaches:
- **Option A**: `data-i18n` attributes + a `translateDOM()` function that walks the DOM.
  Pros: HTML stays readable. Cons: extra DOM pass.
- **Option B**: All static text set via JS on init.
  Pros: single source of truth. Cons: HTML looks empty.

Recommend **Option A** — `data-i18n` for textContent, `data-i18n-title` for titles,
`data-i18n-placeholder` for inputs. One `translateDOM()` call on init + locale switch.

## Scope

### In scope

- [ ] Install i18next (`npm i i18next`)
- [ ] Create `src/i18n/index.js` — i18next init, `t()` export, `translateDOM()`, `setLocale()`
- [ ] Create `src/i18n/locales/en.json` — all English strings (~300 keys)
- [ ] Create `src/i18n/locales/zh-TW.json` — all Traditional Chinese strings
- [ ] Add `data-i18n` attributes to `index.html` static strings
- [ ] Replace hardcoded strings in JS modules with `t()` calls (16 files)
- [ ] Add locale switcher UI to toolbar
- [ ] Persist locale in localStorage
- [ ] Update tests for i18n (locale init, key coverage)

### Out of scope (→ backlog)

- Additional locales (zh-CN, ja, ko)
- CLDR plural rules beyond English/Chinese
- RTL support
- Locale stored in Firestore user profile
- Date/number formatting per locale (keep `timeZone: 'Asia/Taipei'` + `en-US` for now)
- i18next-scanner automation (manual key management for now)
- Lazy-loading locale JSONs

## Phases

### Phase 1: Install + core setup

- [ ] `npm i i18next`
- [ ] Create `src/i18n/index.js`:
  ```js
  import i18next from 'i18next';
  import en from './locales/en.json';
  import zhTW from './locales/zh-TW.json';

  export async function initI18n() {
    const saved = localStorage.getItem('ganttpro-locale') || 'en';
    await i18next.init({
      lng: saved,
      fallbackLng: 'en',
      resources: { en: { translation: en }, 'zh-TW': { translation: zhTW } },
      interpolation: { escapeValue: false },
    });
  }

  export function t(key, opts) { return i18next.t(key, opts); }

  export function setLocale(lng) {
    i18next.changeLanguage(lng);
    localStorage.setItem('ganttpro-locale', lng);
    translateDOM();
    // caller triggers app re-render
  }

  export function translateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
  }
  ```
- [ ] Wire into `main.js` DOMContentLoaded: `await initI18n()` before render
- [ ] Smoke test: app loads with i18next initialized, no runtime errors

### Phase 2: Create locale JSONs — extract keys from all modules

Organized by module, ~300 keys total.

**en.json skeleton** (populate all keys):

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "close": "Close",
    "undo": "Undo",
    "today": "Today",
    "expandAll": "Expand All",
    "collapseAll": "Collapse All",
    "done": "Done",
    "pending": "Pending",
    "overdue": "Overdue",
    "yes": "Yes",
    "no": "No"
  },
  "toolbar": {
    "share": "Share this project",
    "undoHint": "Undo (Ctrl+Z)",
    "jumpToToday": "Jump to today",
    "zoomIn": "Zoom in",
    "zoomOut": "Zoom out",
    "fitToWindow": "Fit to window",
    "criticalPath": "Critical Path",
    "export": "Export",
    "exportPNG": "Export PNG",
    "exportPDF": "Export PDF",
    "exportCSV": "Export CSV (Excel)",
    "collaborate": "Collaborate",
    "darkMode": "Dark mode",
    "settings": "Settings",
    "admin": "Admin panel",
    "signOut": "Sign Out",
    "milestones": "Milestones",
    "readonly": "Read-only"
  },
  "status": {
    "period": "Period",
    "tasks": "{{count}} tasks"
  },
  "taskPanel": {
    "noTasks": "No tasks yet",
    "noProjects": "No projects yet",
    "addTask": "+ Add Task",
    "createFirstProject": "+ Create Your First Project",
    "milestone": "◆ Milestone",
    "assignee": "Assignee: {{name}}",
    "fixedDate": "Fixed date — not auto-scheduled",
    "markIncomplete": "Click to mark as incomplete",
    "markDone": "Click to mark as done",
    "outdent": "Outdent (move to parent level)",
    "indent": "Indent (nest under previous sibling)",
    "addSubtask": "Add task under this node",
    "deleteTask": "Delete task"
  },
  "tooltip": {
    "start": "Start",
    "end": "End",
    "workdays": "Workdays",
    "progress": "Progress",
    "assignee": "Assignee",
    "status": "Status",
    "date": "Date",
    "fsDep": "FS dep",
    "ssDep": "SS dep",
    "ffDep": "FF dep",
    "sfDep": "SF dep",
    "baselineDrift": "Baseline drift",
    "subTasks": "Sub-tasks",
    "overallProgress": "Overall progress"
  },
  "workload": {
    "unassigned": "Unassigned",
    "noActiveTasks": "No active tasks",
    "active": "{{count}} active"
  },
  "modal": {
    "newTask": "New Task",
    "editTask": "Edit Task",
    "taskName": "Task Name",
    "taskNamePlaceholder": "Enter task name...",
    "startDate": "Start Date",
    "endDate": "End Date",
    "workdays": "Workdays",
    "progress": "Progress (%)",
    "dependencies": "Dependencies",
    "depsPlaceholder": "Enter row numbers (e.g. 2, 2SS, 2FS+3) or pick below",
    "assignee": "Assignee",
    "assigneePlaceholder": "Enter name (optional)",
    "type": "Type",
    "task": "Task",
    "group": "Group",
    "milestone": "Milestone",
    "color": "Color",
    "saveChanges": "Save Changes",
    "addTask": "Add Task",
    "noneTopLevel": "— None (top level) —",
    "noDepsAvailable": "No dependencies available",
    "enterConfirm": "Enter to confirm",
    "escCancel": "Esc to cancel",
    "deleteConfirm": "Delete \"{{name}}\"? This action cannot be undone.",
    "deleteGroupConfirm": "Delete group \"{{name}}\" and all {{count}} sub-tasks?",
    "indentLimit": "Cannot indent: parent is already a task (max depth = groups + tasks).",
    "depSelfRef": "Cannot depend on itself",
    "depNotFound": "Row {{row}} not found",
    "depInvalidFormat": "Invalid format (expected: 2FS, 3SS, or 2FS+3)",
    "depCycle": "Circular dependency detected"
  },
  "project": {
    "noProjects": "— No projects —",
    "shared": "Shared",
    "newProject": "+ New Project",
    "editProject": "Edit Project",
    "deleteConfirm": "Delete \"{{name}}\"? This action cannot be undone.",
    "createProject": "Create Project",
    "blankProject": "— Blank Project —",
    "template": "Template",
    "templatePreview": "Template: {{groups}} phases, {{tasks}} tasks, {{milestones}} milestones",
    "duplicateName": "A project named \"{{name}}\" already exists. Duplicate names can be confusing.\n\nUse this name anyway?",
    "projectName": "Project Name",
    "projectNamePlaceholder": "e.g. Website Redesign, Q3 Marketing Campaign..."
  },
  "settings": {
    "baselineSet": "Baseline set ({{date}})",
    "versionCreated": "✓ Version \"{{name}}\" created",
    "restoreConfirm": "Restore to version \"{{name}}\"?\nCurrent changes will be overwritten. This cannot be undone.",
    "restored": "✓ Restored to \"{{name}}\"",
    "deleteVersionConfirm": "Delete version \"{{name}}\"?",
    "noVersions": "No versions yet\nEdit your project, enter a version name,\nand click \"Create Version\" to save a snapshot",
    "versionHistory": "Version History",
    "createVersion": "Create Version",
    "restore": "Restore",
    "delete": "Delete",
    "setBaseline": "Set Baseline",
    "versionHistoryBtn": "Version History",
    "versionNamePlaceholder": "Version name, e.g. v1.0 Requirements Review",
    "exportSettings": "Export Settings",
    "format": "Format",
    "density": "Density",
    "compact": "Compact",
    "default": "Default",
    "comfortable": "Comfortable"
  },
  "auth": {
    "login": "Sign in",
    "guest": "Continue as Guest",
    "register": "Register",
    "or": "or",
    "googleLogin": "Sign in with Google",
    "checkingLogin": "Checking login status...",
    "loginFailed": "Login failed. Please try again.",
    "registerNicknamePlaceholder": "Enter nickname (max 20 chars)",
    "registerEmailPlaceholder": "Enter your Gmail address",
    "registerPasswordPlaceholder": "Enter password (min 6 chars)",
    "registerSubmit": "Register",
    "nicknameRequired": "Please enter a nickname.",
    "emailRequired": "Please enter your Gmail address.",
    "passwordRequired": "Password must be at least 6 characters.",
    "emailInUse": "This email is already registered. Try signing in instead.",
    "weakPassword": "Password is too weak. Use at least 6 characters.",
    "invalidEmail": "Please enter a valid Gmail address.",
    "registerSuccess": "✓ Registration successful! Welcome, {{name}}.",
    "loggedOut": "Signed out.",
    "guestAvatar": "Guest"
  },
  "share": {
    "shareProject": "Share Project: {{name}}",
    "ownerNote": "This is a read-only link. Only you (the project owner) can edit in normal mode.",
    "linkCopied": "✓ Share link copied to clipboard",
    "linkCopiedShort": "✓ Share link copied",
    "linkFailed": "Failed to generate link. Please try again.",
    "collaboratorEmail": "Enter collaborator's Gmail address",
    "addCollaborator": "Add Collaborator",
    "removeAccess": "Remove access for {{email}}?",
    "added": "✓ Successfully added",
    "collaboration": "Collaboration",
    "remove": "Remove",
    "invalidLink": "This share link is invalid or has expired."
  },
  "admin": {
    "userManagement": "User Management",
    "loading": "Loading...",
    "userCount": "({{count}} users)",
    "noUsers": "No users found",
    "deleteUserConfirm": "Delete user \"{{name}}\"? This cannot be undone.",
    "adminLabel": "Admin",
    "userLabel": "User",
    "addedAt": "Added"
  },
  "export": {
    "exportDate": "Export date",
    "tasks": "Tasks",
    "milestones": "Milestones",
    "taskName": "Task Name",
    "startDate": "Start Date",
    "endDate": "End Date",
    "workdays": "Workdays",
    "progress": "Progress%",
    "dependencies": "Dependencies",
    "done": "Done",
    "typeGroup": "Group",
    "typeMilestone": "Milestone",
    "typeTask": "Task",
    "printed": "Printed",
    "period": "Period",
    "taskCount": "{{count}} tasks"
  },
  "chart": {
    "today": "Today",
    "months": {
      "jan": "Jan", "feb": "Feb", "mar": "Mar", "apr": "Apr",
      "may": "May", "jun": "Jun", "jul": "Jul", "aug": "Aug",
      "sep": "Sep", "oct": "Oct", "nov": "Nov", "dec": "Dec"
    },
    "days": {
      "sun": "Sun", "mon": "Mon", "tue": "Tue", "wed": "Wed",
      "thu": "Thu", "fri": "Fri", "sat": "Sat"
    }
  }
}
```

zh-TW.json: same keys, Traditional Chinese values (restore original strings).

- [ ] Create `en.json` with all keys populated
- [ ] Create `zh-TW.json` with all keys populated (restore original zh-TW strings)
- [ ] Verify JSON validity (`node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json'))"`)

### Phase 3: index.html — add data-i18n attributes

- [ ] Add `data-i18n="key"` to all textContent elements (~15 elements)
- [ ] Add `data-i18n-title="key"` to all title attributes (~20 elements)
- [ ] Add `data-i18n-placeholder="key"` to all placeholder attributes (~8 elements)
- [ ] Call `translateDOM()` after `initI18n()` in DOMContentLoaded
- [ ] Verify: all static HTML text switches on locale change

### Phase 4: Replace JS strings with t() calls

16 files, ~150 string-assignment sites. Per file:

- [ ] `src/main.js` — sync dots, share-invalid screen, guest avatar, indent limit,
      period display (~10 sites)
- [ ] `src/auth.js` — login errors, registration validation, empty nickname warning (~15 sites)
- [ ] `src/collab.js` — email validation, share messages, remove confirms, permission labels (~12 sites)
- [ ] `src/admin.js` — loading text, user/admin labels, delete confirms (~8 sites)
- [ ] `src/ui/modal.js` — modal title, labels, dropdown options, delete warnings (~25 sites)
- [ ] `src/ui/project.js` — empty state, menu items, template descriptions, duplicate confirm (~12 sites)
- [ ] `src/ui/settings.js` — baseline message, version confirm/restore/delete, empty state (~10 sites)
- [ ] `src/render/task-panel.js` — empty states, milestone badge, action tooltips (~10 sites)
- [ ] `src/render/tooltip.js` — field labels, status indicators (~15 sites)
- [ ] `src/render/workload.js` — unassigned sentinel, empty state, active count (~6 sites)
- [ ] `src/render/chart-header.js` — month names, day names (~3 sites)
- [ ] `src/render/chart-body.js` — today label (~1 site)
- [ ] `src/render/milestone.js` — today label (~1 site)
- [ ] `src/export.js` — canvas text, CSV headers, PDF metadata (~10 sites)
- [ ] `src/core/deps.js` — error messages (~4 sites)
- [ ] `src/core/calendar.js` — holiday names (~40 sites, TW_HOLIDAYS values)

**Key gotcha**: `'Unassigned'` in workload.js is a display string AND sort sentinel AND
localeCompare key. Must change all 3 refs together (same as i18n Phase 4).

### Phase 5: Locale switcher UI

- [ ] Add language dropdown to toolbar HTML (near dark mode button):
  ```html
  <select id="langSelect" class="btn" title="Language">
    <option value="en">EN</option>
    <option value="zh-TW">繁中</option>
  </select>
  ```
- [ ] Wire `change` event: call `setLocale(value)` → `render()` (full app re-render)
- [ ] Set `<select>` value from `localStorage` on load
- [ ] Update `<html lang="...">` attribute on switch
- [ ] Visual test: switch locale, verify all text updates without page reload

### Phase 6: Verify

- [ ] `npm test` — all tests green
- [ ] `npm run build` — production build succeeds
- [ ] Manual smoke test: switch between EN ↔ zh-TW, verify:
  - Toolbar, status bar, task panel, chart headers, tooltips
  - Modal open/close, project CRUD, settings panel
  - Export PNG/CSV/PDF (text rendered on canvas/CSV)
  - Share modal, collab modal, admin panel
  - Dark mode toggle (no text regressions)
- [ ] Grep for remaining hardcoded English in string literals that should be `t()` calls
- [ ] Verify no runtime errors in console on locale switch

## Key files

- `src/i18n/index.js` — i18next init, t(), translateDOM(), setLocale() (new)
- `src/i18n/locales/en.json` — English locale (new, ~300 keys)
- `src/i18n/locales/zh-TW.json` — Traditional Chinese locale (new, ~300 keys)
- `index.html` — data-i18n attributes on static strings
- `src/main.js` — wire initI18n() + setLocale() into app lifecycle
- 16 JS modules — replace hardcoded strings with t() calls

## Risk: tw_HOLIDAYS locale switch

Holiday names in `calendar.js` are a Map lookup (`TW_HOLIDAYS[dateKey]`). On locale switch,
the TW_HOLIDAYS values must change. Options:

1. **Regenerate TW_HOLIDAYS on locale switch** — call a `getHolidayNames()` that reads from
   the active locale JSON. TW_HOLIDAYS becomes a function, not a const.
2. **Store holiday keys, not display names** — `TW_HOLIDAYS['2026-01-01'] = 'newYear'` and
   `t('holidays.newYear')` at display time.

Option 2 is cleaner (SSOT), but requires changing the `getHoliday()` API to return a key
instead of a display name. All call sites must wrap with `t()`. Moderate refactor.

Recommend **Option 2** — it's the correct SSOT pattern and `getHoliday()` is only called
in tooltip.js and schedule.js (2 call sites).

## Risk: template task names

TEMPLATES and demo project data have ~35 task names each (duplicated). Options:

1. Store task names as keys in locale JSON — but task names are user data, not UI labels.
2. Store task names in English, translate at display time — but task names are stored in
   Firestore as-is (no translation layer in DB).
3. Store task names as-is (English), accept they don't translate — simplest, and task names
   are user-editable anyway.

Recommend **Option 3** — task names are user data. The template provides English defaults;
users rename tasks in their language. The TEMPLATES array is a starter scaffold, not UI copy.
