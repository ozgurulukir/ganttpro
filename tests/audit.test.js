/* audit.test.js — unit tests for audit log storage and DOM rendering */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Initialize DOM environment prior to importing modules that depend on window/document/localStorage
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

import { initI18n } from '../src/i18n/index.js';
import { logAudit, getAuditLog, clearAuditLog, renderAuditLog } from '../src/data/audit.js';

await initI18n();

describe('audit log data layer', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('logAudit adds an entry and getAuditLog retrieves it', () => {
    logAudit('taskCreated', 'Created Task 1');
    const log = getAuditLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].action, 'taskCreated');
    assert.equal(log[0].detail, 'Created Task 1');
    assert.ok(log[0].ts);
  });

  it('logAudit truncates detail over 500 characters', () => {
    const longDetail = 'a'.repeat(600);
    logAudit('taskEdited', longDetail);
    const log = getAuditLog();
    assert.equal(log[0].detail.length, 500);
    assert.equal(log[0].detail, 'a'.repeat(500));
  });

  it('logAudit caps entries at MAX_ENTRIES (200)', () => {
    for (let i = 0; i < 210; i++) {
      logAudit('taskEdited', `Item ${i}`);
    }
    const log = getAuditLog();
    assert.equal(log.length, 200);
    assert.equal(log[0].detail, 'Item 10');
    assert.equal(log[199].detail, 'Item 209');
  });

  it('getAuditLog returns [] on empty or invalid localStorage JSON', () => {
    assert.deepEqual(getAuditLog(), []);
    localStorage.setItem('gp_audit', 'invalid-json');
    assert.deepEqual(getAuditLog(), []);
  });

  it('clearAuditLog removes entry from localStorage', () => {
    logAudit('taskDeleted', 'Task 2');
    assert.equal(getAuditLog().length, 1);
    clearAuditLog();
    assert.equal(getAuditLog().length, 0);
  });
});

describe('renderAuditLog', () => {
  let container;

  beforeEach(() => {
    clearAuditLog();
    container = document.createElement('div');
  });

  it('renders empty message when audit log is empty', () => {
    renderAuditLog(container);
    assert.equal(container.children.length, 1);
    const emptyEl = container.children[0];
    assert.equal(emptyEl.tagName, 'DIV');
    assert.equal(emptyEl.textContent, 'No audit entries yet');
  });

  it('renders entries in reverse chronological order', () => {
    logAudit('taskCreated', 'First action');
    logAudit('taskEdited', 'Second action');

    renderAuditLog(container);
    assert.equal(container.children.length, 2);

    const firstRow = container.children[0];
    const secondRow = container.children[1];

    assert.equal(firstRow.className, 'audit-row');
    assert.equal(firstRow.querySelector('.audit-detail').textContent, 'Second action');

    assert.equal(secondRow.className, 'audit-row');
    assert.equal(secondRow.querySelector('.audit-detail').textContent, 'First action');
  });

  it('translates known action types correctly and falls back to raw action for unknown types', () => {
    logAudit('taskCreated', 'Detail 1');
    logAudit('versionRestored', 'Detail 2');
    logAudit('customAction', 'Detail 3');

    renderAuditLog(container);
    assert.equal(container.children.length, 3);

    // Row 0 is customAction (newest)
    assert.equal(container.children[0].querySelector('.audit-action').textContent, 'customAction');
    // Row 1 is versionRestored
    assert.equal(
      container.children[1].querySelector('.audit-action').textContent,
      'Version restored'
    );
    // Row 2 is taskCreated
    assert.equal(container.children[2].querySelector('.audit-action').textContent, 'Task created');
  });

  it('renders audit-time and audit-detail elements when detail is present', () => {
    logAudit('projectCreated', 'Project X');
    renderAuditLog(container);

    const row = container.children[0];
    const timeEl = row.querySelector('.audit-time');
    const actionEl = row.querySelector('.audit-action');
    const detailEl = row.querySelector('.audit-detail');

    assert.ok(timeEl);
    assert.ok(actionEl);
    assert.ok(detailEl);
    assert.equal(actionEl.textContent, 'Project created');
    assert.equal(detailEl.textContent, 'Project X');
  });

  it('omits audit-detail element when detail is empty', () => {
    logAudit('projectDeleted', '');
    renderAuditLog(container);

    const row = container.children[0];
    const detailEl = row.querySelector('.audit-detail');
    assert.equal(detailEl, null);
  });

  it('clears pre-existing container children when re-rendering', () => {
    const oldChild = document.createElement('span');
    oldChild.textContent = 'Old content';
    container.appendChild(oldChild);

    logAudit('taskCreated', 'New Task');
    renderAuditLog(container);

    assert.equal(
      container.querySelector('span:not(.audit-time):not(.audit-action):not(.audit-detail)'),
      null
    );
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].className, 'audit-row');
  });
});
