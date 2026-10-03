import { test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  loadFromLS,
  saveToLS,
  loadWorkCalendarSettings,
  WORKDAYS_KEY,
  HOLIDAYS_KEY
} from '../src/data/local.js';

// Setup in-memory localStorage mock for Node environment
const store = new Map();
const mockLocalStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
  clear: () => store.clear()
};

globalThis.localStorage = mockLocalStorage;

const LS_KEY = 'ganttpro_v1';

beforeEach(() => {
  store.clear();
});

/* ── loadFromLS ── */

test('loadFromLS — returns null when localStorage is empty', () => {
  assert.equal(loadFromLS(), null);
});

test('loadFromLS — returns parsed data when valid JSON is stored', () => {
  const sampleData = { tasks: [{ id: '1', name: 'Task 1' }], view: 'month' };
  mockLocalStorage.setItem(LS_KEY, JSON.stringify(sampleData));

  const result = loadFromLS();
  assert.deepEqual(result, sampleData);
});

test('loadFromLS — returns null when localStorage contains invalid JSON', () => {
  mockLocalStorage.setItem(LS_KEY, '{ invalid json ...');

  const result = loadFromLS();
  assert.equal(result, null);
});

test('loadFromLS — returns null when localStorage.getItem throws an exception', () => {
  const originalGetItem = mockLocalStorage.getItem;
  mockLocalStorage.getItem = () => {
    throw new Error('SecurityError: Access is denied');
  };

  try {
    const result = loadFromLS();
    assert.equal(result, null);
  } finally {
    mockLocalStorage.getItem = originalGetItem;
  }
});

/* ── saveToLS ── */

test('saveToLS — saves stringified data to localStorage', () => {
  const sampleData = { tasks: [{ id: '2', name: 'Task 2' }] };
  saveToLS(sampleData);

  const raw = mockLocalStorage.getItem(LS_KEY);
  assert.equal(raw, JSON.stringify(sampleData));
});

test('saveToLS — throws error when localStorage.setItem fails', () => {
  const originalSetItem = mockLocalStorage.setItem;
  mockLocalStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };

  try {
    assert.throws(() => {
      saveToLS({ test: true });
    }, /QuotaExceededError/);
  } finally {
    mockLocalStorage.setItem = originalSetItem;
  }
});

/* ── loadWorkCalendarSettings ── */

test('loadWorkCalendarSettings — returns default workdays and empty holidays when empty', () => {
  const settings = loadWorkCalendarSettings();
  assert.deepEqual(settings, {
    workdays: [1, 2, 3, 4, 5],
    holidays: []
  });
});

test('loadWorkCalendarSettings — loads stored workdays and holidays when present', () => {
  const customWorkdays = [1, 2, 3, 4];
  const customHolidays = [{ date: '2026-01-01', label: 'New Year' }];

  mockLocalStorage.setItem(WORKDAYS_KEY, JSON.stringify(customWorkdays));
  mockLocalStorage.setItem(HOLIDAYS_KEY, JSON.stringify(customHolidays));

  const settings = loadWorkCalendarSettings();
  assert.deepEqual(settings, {
    workdays: customWorkdays,
    holidays: customHolidays
  });
});

test('loadWorkCalendarSettings — handles corrupted JSON gracefully by returning defaults', () => {
  mockLocalStorage.setItem(WORKDAYS_KEY, 'invalid');
  mockLocalStorage.setItem(HOLIDAYS_KEY, 'corrupted');

  const settings = loadWorkCalendarSettings();
  assert.deepEqual(settings, {
    workdays: [1, 2, 3, 4, 5],
    holidays: []
  });
});
