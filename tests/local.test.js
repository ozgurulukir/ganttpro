import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  saveToLS,
  loadWorkCalendarSettings,
  loadFromLS,
  getOwnerId,
  WORKDAYS_KEY,
  HOLIDAYS_KEY
} from '../src/data/local.js';

describe('src/data/local.js', () => {
  let mockStore = {};
  let originalLocalStorage;
  let originalConsoleError;
  let consoleErrorCalls = [];

  beforeEach(() => {
    mockStore = {};
    originalLocalStorage = globalThis.localStorage;
    originalConsoleError = console.error;
    consoleErrorCalls = [];

    console.error = (...args) => {
      consoleErrorCalls.push(args);
    };

    globalThis.localStorage = {
      getItem: key => mockStore[key] ?? null,
      setItem: (key, value) => {
        mockStore[key] = String(value);
      },
      removeItem: key => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      }
    };
  });

  afterEach(() => {
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
    console.error = originalConsoleError;
  });

  describe('saveToLS', () => {
    it('serializes data and saves it to localStorage under ganttpro_v1', () => {
      const testData = { tasks: [{ id: 1, name: 'Task 1' }], title: 'Test Project' };
      saveToLS(testData);

      assert.strictEqual(globalThis.localStorage.getItem('ganttpro_v1'), JSON.stringify(testData));
    });

    it('logs error and rethrows exception when localStorage.setItem throws (QuotaExceededError)', () => {
      const quotaError = new Error('QuotaExceededError');
      quotaError.name = 'QuotaExceededError';

      globalThis.localStorage.setItem = () => {
        throw quotaError;
      };

      const testData = { data: 'large data payload' };

      assert.throws(
        () => {
          saveToLS(testData);
        },
        err => {
          assert.strictEqual(err, quotaError);
          return true;
        }
      );

      assert.strictEqual(consoleErrorCalls.length, 1);
      assert.strictEqual(consoleErrorCalls[0][0], 'saveToLS:');
      assert.strictEqual(consoleErrorCalls[0][1], quotaError);
    });
  });

  describe('loadWorkCalendarSettings', () => {
    it('returns default workdays and empty holidays when localStorage is empty', () => {
      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4, 5],
        holidays: []
      });
    });

    it('loads custom workdays and holidays from localStorage', () => {
      globalThis.localStorage.setItem(WORKDAYS_KEY, JSON.stringify([1, 2, 3, 4]));
      globalThis.localStorage.setItem(
        HOLIDAYS_KEY,
        JSON.stringify([{ date: '2026-12-25', label: 'Christmas' }])
      );

      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4],
        holidays: [{ date: '2026-12-25', label: 'Christmas' }]
      });
    });

    it('falls back to default values if stored JSON is malformed', () => {
      globalThis.localStorage.setItem(WORKDAYS_KEY, 'invalid json');
      globalThis.localStorage.setItem(HOLIDAYS_KEY, '{malformed');

      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4, 5],
        holidays: []
      });
    });

    it('falls back to default workdays when workdays JSON is malformed but holidays JSON is valid', () => {
      globalThis.localStorage.setItem(WORKDAYS_KEY, 'invalid json');
      globalThis.localStorage.setItem(
        HOLIDAYS_KEY,
        JSON.stringify([{ date: '2026-01-01', label: 'New Year' }])
      );

      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4, 5],
        holidays: [{ date: '2026-01-01', label: 'New Year' }]
      });
    });

    it('falls back to default holidays when holidays JSON is malformed but workdays JSON is valid', () => {
      globalThis.localStorage.setItem(WORKDAYS_KEY, JSON.stringify([1, 2, 3]));
      globalThis.localStorage.setItem(HOLIDAYS_KEY, 'invalid json');

      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3],
        holidays: []
      });
    });

    it('falls back to default values when stored JSON parses to null or falsy value', () => {
      globalThis.localStorage.setItem(WORKDAYS_KEY, 'null');
      globalThis.localStorage.setItem(HOLIDAYS_KEY, 'null');

      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4, 5],
        holidays: []
      });
    });

    it('falls back to default values when localStorage.getItem throws an exception', () => {
      globalThis.localStorage.getItem = () => {
        throw new Error('Access denied');
      };

      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4, 5],
        holidays: []
      });
    });
  });

  describe('loadFromLS', () => {
    it('returns null if ganttpro_v1 is not set', () => {
      assert.strictEqual(loadFromLS(), null);
    });

    it('parses and returns saved object from localStorage', () => {
      const testData = { tasks: [{ id: 10 }] };
      globalThis.localStorage.setItem('ganttpro_v1', JSON.stringify(testData));

      assert.deepStrictEqual(loadFromLS(), testData);
    });

    it('returns null when JSON parsing fails', () => {
      globalThis.localStorage.setItem('ganttpro_v1', 'corrupted data');
      assert.strictEqual(loadFromLS(), null);
    });
  });

  describe('getOwnerId', () => {
    it('generates, stores, and returns a new owner id if none exists', () => {
      const ownerId = getOwnerId();
      assert.ok(typeof ownerId === 'string');
      assert.ok(ownerId.startsWith('own_'));
      assert.strictEqual(globalThis.localStorage.getItem('ganttpro_owner_id'), ownerId);
    });

    it('returns existing owner id from localStorage if present', () => {
      globalThis.localStorage.setItem('ganttpro_owner_id', 'own_existing123');
      const ownerId = getOwnerId();
      assert.strictEqual(ownerId, 'own_existing123');
    });
  });
});
