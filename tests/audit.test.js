import { test, beforeEach, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { logAudit, getAuditLog, clearAuditLog, renderAuditLog } from '../src/data/audit.js';
import { initI18n } from '../src/i18n/index.js';

// Setup mock localStorage in global scope for Node environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;

// Simple mock document element factory for DOM rendering tests
if (typeof globalThis.document === 'undefined') {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.style = {};
      this.className = '';
      this.textContent = '';
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    append(...children) {
      for (const child of children) {
        this.children.push(child);
      }
    }
    replaceChildren(...children) {
      this.children = [...children];
    }
  }

  globalThis.document = {
    createElement(tagName) {
      return new MockElement(tagName);
    }
  };
}

before(async () => {
  await initI18n();
});

beforeEach(() => {
  mockStorage.clear();
});

test('logAudit — appends entry to empty log with correct ts, action, and detail', context => {
  context.mock.timers.enable({ apis: ['Date'] });
  context.mock.timers.setTime(1700000000000);
  const expectedIso = new Date(1700000000000).toISOString();

  logAudit('taskCreated', 'Created Task A');

  const entries = getAuditLog();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].action, 'taskCreated');
  assert.equal(entries[0].detail, 'Created Task A');
  assert.equal(entries[0].ts, expectedIso);
});

test('logAudit — truncates detail strings longer than 500 characters', () => {
  const longDetail = 'a'.repeat(600);
  logAudit('taskEdited', longDetail);

  const entries = getAuditLog();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].detail.length, 500);
  assert.equal(entries[0].detail, 'a'.repeat(500));
});

test('logAudit — truncates log to MAX_ENTRIES (200) when entries exceed 200 items', () => {
  for (let i = 0; i < 205; i++) {
    logAudit('taskCreated', `Task ${i}`);
  }

  const entries = getAuditLog();
  assert.equal(entries.length, 200);
  // The first 5 entries (0..4) should have been removed
  assert.equal(entries[0].detail, 'Task 5');
  assert.equal(entries[199].detail, 'Task 204');
});

test('logAudit — catches QuotaExceededError gracefully without throwing', () => {
  const originalSetItem = mockStorage.setItem;
  mockStorage.setItem = () => {
    const err = new Error('Quota exceeded');
    err.name = 'QuotaExceededError';
    throw err;
  };

  try {
    assert.doesNotThrow(() => {
      logAudit('taskCreated', 'Will fail');
    });
  } finally {
    mockStorage.setItem = originalSetItem;
  }
});

test('getAuditLog — returns empty array if localStorage is empty or contains invalid JSON', () => {
  assert.deepEqual(getAuditLog(), []);

  mockStorage.setItem('gp_audit', 'invalid JSON');
  assert.deepEqual(getAuditLog(), []);
});

test('clearAuditLog — removes audit log from localStorage', () => {
  logAudit('taskCreated', 'Test entry');
  assert.equal(getAuditLog().length, 1);

  clearAuditLog();
  assert.equal(getAuditLog().length, 0);
  assert.equal(mockStorage.getItem('gp_audit'), null);
});

test('renderAuditLog — renders empty message when no audit entries exist', () => {
  const container = document.createElement('div');
  renderAuditLog(container);

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].textContent, 'No audit entries yet');
});

test('renderAuditLog — renders audit entries in reverse chronological order', () => {
  logAudit('taskCreated', 'First detail');
  logAudit('taskEdited', 'Second detail');

  const container = document.createElement('div');
  renderAuditLog(container);

  assert.equal(container.children.length, 2);

  // First row in DOM should be the most recent entry ('taskEdited')
  const row1 = container.children[0];
  assert.equal(row1.className, 'audit-row');
  assert.equal(row1.children[1].textContent, 'Task edited');
  assert.equal(row1.children[2].textContent, 'Second detail');

  // Second row in DOM should be the older entry ('taskCreated')
  const row2 = container.children[1];
  assert.equal(row2.className, 'audit-row');
  assert.equal(row2.children[1].textContent, 'Task created');
  assert.equal(row2.children[2].textContent, 'First detail');
});
