import { describe, it, beforeEach, afterEach, before } from 'node:test';
import assert from 'node:assert';
import { clearAuditLog, logAudit, getAuditLog, renderAuditLog } from '../src/data/audit.js';
import { initI18n } from '../src/i18n/index.js';

describe('audit.js', () => {
  let originalLocalStorage;
  let originalConsoleWarn;
  let warnLogs = [];
  let store = new Map();

  before(async () => {
    globalThis.localStorage = {
      getItem: key => store.get(key) ?? null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: key => store.delete(key),
      clear: () => store.clear()
    };
    await initI18n();
  });

  beforeEach(() => {
    store.clear();
    warnLogs = [];
    originalLocalStorage = globalThis.localStorage;
    originalConsoleWarn = console.warn;

    globalThis.localStorage = {
      getItem: key => store.get(key) ?? null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: key => store.delete(key),
      clear: () => store.clear()
    };

    console.warn = (...args) => {
      warnLogs.push(args);
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
    console.warn = originalConsoleWarn;
  });

  describe('clearAuditLog', () => {
    it('removes the audit log entry from localStorage', () => {
      logAudit('taskCreated', 'Test Task');
      assert.equal(getAuditLog().length, 1);

      clearAuditLog();

      assert.equal(getAuditLog().length, 0);
      assert.equal(globalThis.localStorage.getItem('gp_audit'), null);
    });

    it('handles localStorage.removeItem errors gracefully', () => {
      globalThis.localStorage.removeItem = () => {
        throw new Error('Storage access denied');
      };

      assert.doesNotThrow(() => {
        clearAuditLog();
      });

      assert.equal(warnLogs.length, 1);
      assert.equal(warnLogs[0][0], 'Audit log: failed to clear.');
      assert.equal(warnLogs[0][1].message, 'Storage access denied');
    });
  });

  describe('logAudit & getAuditLog', () => {
    it('returns an empty array when audit log is empty or invalid JSON', () => {
      assert.deepStrictEqual(getAuditLog(), []);

      globalThis.localStorage.setItem('gp_audit', 'invalid-json');
      assert.deepStrictEqual(getAuditLog(), []);
    });

    it('logs entries and limits to MAX_ENTRIES (200)', () => {
      logAudit('taskCreated', 'Task 1');
      const entries = getAuditLog();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].action, 'taskCreated');
      assert.equal(entries[0].detail, 'Task 1');
      assert.ok(entries[0].ts);

      // Log 205 entries to verify MAX_ENTRIES truncation (keeping latest 200)
      for (let i = 2; i <= 205; i++) {
        logAudit('taskEdited', `Task ${i}`);
      }

      const truncated = getAuditLog();
      assert.equal(truncated.length, 200);
      assert.equal(truncated[0].detail, 'Task 6');
      assert.equal(truncated[199].detail, 'Task 205');
    });

    it('truncates detail text exceeding 500 characters', () => {
      const longDetail = 'a'.repeat(600);
      logAudit('projectCreated', longDetail);
      const entries = getAuditLog();
      assert.equal(entries[0].detail.length, 500);
    });

    it('handles QuotaExceededError when setting item fails', () => {
      globalThis.localStorage.setItem = () => {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      };

      logAudit('taskCreated', 'Test');
      assert.equal(warnLogs.length, 1);
      assert.equal(warnLogs[0][0], 'Audit log: LocalStorage quota exceeded.');
    });
  });

  describe('renderAuditLog', () => {
    let mockContainer;

    beforeEach(() => {
      const children = [];
      mockContainer = {
        children,
        replaceChildren() {
          children.length = 0;
        },
        appendChild(child) {
          children.push(child);
        }
      };

      // Mock DOM document.createElement
      globalThis.document = {
        createElement(tagName) {
          const el = {
            tagName,
            style: {},
            className: '',
            textContent: '',
            children: [],
            append(...nodes) {
              this.children.push(...nodes);
            },
            appendChild(node) {
              this.children.push(node);
            }
          };
          return el;
        }
      };
    });

    it('renders empty message when log is empty', () => {
      renderAuditLog(mockContainer);
      assert.equal(mockContainer.children.length, 1);
      assert.equal(mockContainer.children[0].textContent, 'No audit entries yet');
    });

    it('renders rows in reverse chronological order with action labels and details', () => {
      logAudit('taskCreated', 'Detail 1');
      logAudit('taskDeleted', 'Detail 2');

      renderAuditLog(mockContainer);
      assert.equal(mockContainer.children.length, 2);

      // Most recent entry should be rendered first
      const firstRow = mockContainer.children[0];
      assert.equal(firstRow.className, 'audit-row');
      assert.equal(firstRow.children[1].textContent, 'Task deleted');
      assert.equal(firstRow.children[2].textContent, 'Detail 2');

      const secondRow = mockContainer.children[1];
      assert.equal(secondRow.className, 'audit-row');
      assert.equal(secondRow.children[1].textContent, 'Task created');
      assert.equal(secondRow.children[2].textContent, 'Detail 1');
    });
  });
});
