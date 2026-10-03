import { test, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

// Mock localStorage globally for node environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: key => mockStorage.get(key) ?? null,
  setItem: (key, value) => mockStorage.set(key, String(value)),
  removeItem: key => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

import {
  getOwnerId,
  saveToLS,
  loadFromLS,
  loadWorkCalendarSettings,
  WORKDAYS_KEY,
  HOLIDAYS_KEY
} from '../src/data/local.js';

beforeEach(() => {
  localStorage.clear();
});

test('getOwnerId — returns existing ID when present in localStorage', () => {
  localStorage.setItem('ganttpro_owner_id', 'existing_owner_123');
  const id = getOwnerId();
  assert.equal(id, 'existing_owner_123');
});

test('getOwnerId — generates new ID starting with "own_" and saves to localStorage when absent', () => {
  assert.equal(localStorage.getItem('ganttpro_owner_id'), null);
  const id = getOwnerId();
  assert.ok(id.startsWith('own_'), 'ID should start with "own_"');
  assert.equal(localStorage.getItem('ganttpro_owner_id'), id);
});

test('getOwnerId — subsequent calls return the generated ID', () => {
  const firstId = getOwnerId();
  const secondId = getOwnerId();
  assert.equal(firstId, secondId);
});

test('loadWorkCalendarSettings — returns default workdays and empty holidays if missing or invalid', () => {
  const defaults = loadWorkCalendarSettings();
  assert.deepEqual(defaults, { workdays: [1, 2, 3, 4, 5], holidays: [] });

  localStorage.setItem(WORKDAYS_KEY, 'invalid json');
  localStorage.setItem(HOLIDAYS_KEY, '{invalid');
  const fallback = loadWorkCalendarSettings();
  assert.deepEqual(fallback, { workdays: [1, 2, 3, 4, 5], holidays: [] });
});

test('loadWorkCalendarSettings — loads custom workdays and holidays when present in localStorage', () => {
  localStorage.setItem(WORKDAYS_KEY, JSON.stringify([1, 3, 5]));
  localStorage.setItem(HOLIDAYS_KEY, JSON.stringify([{ date: '2026-01-01', label: 'New Year' }]));

  const settings = loadWorkCalendarSettings();
  assert.deepEqual(settings, {
    workdays: [1, 3, 5],
    holidays: [{ date: '2026-01-01', label: 'New Year' }]
  });
});

test('saveToLS and loadFromLS — saves and loads data correctly', () => {
  assert.equal(loadFromLS(), null);

  const testData = { tasks: [{ id: '1', name: 'Task 1' }] };
  saveToLS(testData);

  assert.deepEqual(loadFromLS(), testData);
});

test('loadFromLS — returns null if invalid JSON in localStorage', () => {
  localStorage.setItem('ganttpro_v1', 'not-valid-json');
  assert.equal(loadFromLS(), null);
});

test('saveToLS — throws error when localStorage.setItem fails', () => {
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };

  assert.throws(() => {
    saveToLS({ test: 1 });
  }, /QuotaExceededError/);

  localStorage.setItem = originalSetItem;
});
