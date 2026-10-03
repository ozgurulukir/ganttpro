import { test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { getAuditLog, logAudit, clearAuditLog } from '../src/data/audit.js';

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  };
}

beforeEach(() => {
  localStorage.clear();
});

test('getAuditLog — returns empty array when localStorage is empty', () => {
  assert.deepEqual(getAuditLog(), []);
});

test('getAuditLog — returns parsed audit entries when present', () => {
  const entries = [{ ts: '2026-05-04T10:00:00.000Z', action: 'taskCreated', detail: 'Task 1' }];
  localStorage.setItem('gp_audit', JSON.stringify(entries));
  assert.deepEqual(getAuditLog(), entries);
});

test('getAuditLog — returns empty array on invalid JSON', () => {
  localStorage.setItem('gp_audit', '{invalid json');
  assert.deepEqual(getAuditLog(), []);
});

test('getAuditLog — returns empty array when localStorage throws', () => {
  const origGetItem = localStorage.getItem;
  localStorage.getItem = () => {
    throw new Error('Storage access error');
  };
  try {
    assert.deepEqual(getAuditLog(), []);
  } finally {
    localStorage.getItem = origGetItem;
  }
});

test('logAudit — appends entry and persists to localStorage', () => {
  logAudit('taskCreated', 'New Task');
  const log = getAuditLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].action, 'taskCreated');
  assert.equal(log[0].detail, 'New Task');
  assert.ok(log[0].ts);
});

test('logAudit — truncates details longer than 500 characters', () => {
  const longDetail = 'a'.repeat(600);
  logAudit('taskEdited', longDetail);
  const log = getAuditLog();
  assert.equal(log[0].detail.length, 500);
});

test('logAudit — caps entries at MAX_ENTRIES (200)', () => {
  for (let i = 0; i < 210; i++) {
    logAudit('taskCreated', `Task ${i}`);
  }
  const log = getAuditLog();
  assert.equal(log.length, 200);
  assert.equal(log[0].detail, 'Task 10');
  assert.equal(log[199].detail, 'Task 209');
});

test('clearAuditLog — removes gp_audit from localStorage', () => {
  logAudit('taskCreated', 'Task 1');
  assert.equal(getAuditLog().length, 1);
  clearAuditLog();
  assert.equal(getAuditLog().length, 0);
  assert.equal(localStorage.getItem('gp_audit'), null);
});
