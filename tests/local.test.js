import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  loadWorkCalendarSettings,
  saveToLS,
  loadFromLS,
  getOwnerId,
  WORKDAYS_KEY,
  HOLIDAYS_KEY
} from '../src/data/local.js';

describe('src/data/local.js', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    globalThis.localStorage = {
      getItem: key => (key in mockStore ? mockStore[key] : null),
      setItem: (key, val) => {
        mockStore[key] = String(val);
      },
      removeItem: key => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      }
    };
  });

  describe('loadWorkCalendarSettings', () => {
    it('returns default workdays and empty holidays when localStorage is empty', () => {
      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4, 5],
        holidays: []
      });
    });

    it('returns stored workdays and holidays when present in localStorage', () => {
      const customWorkdays = [1, 2, 3, 4];
      const customHolidays = [{ date: '2026-01-01', label: 'New Year' }];
      globalThis.localStorage.setItem(WORKDAYS_KEY, JSON.stringify(customWorkdays));
      globalThis.localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(customHolidays));

      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: customWorkdays,
        holidays: customHolidays
      });
    });

    it('falls back to default workdays when JSON stored in WORKDAYS_KEY is invalid', () => {
      globalThis.localStorage.setItem(WORKDAYS_KEY, 'invalid-json-{');
      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings.workdays, [1, 2, 3, 4, 5]);
    });

    it('falls back to default holidays when JSON stored in HOLIDAYS_KEY is invalid', () => {
      globalThis.localStorage.setItem(HOLIDAYS_KEY, 'invalid-json-{');
      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings.holidays, []);
    });

    it('falls back to default workdays/holidays if parsed JSON evaluates to null or falsy', () => {
      globalThis.localStorage.setItem(WORKDAYS_KEY, 'null');
      globalThis.localStorage.setItem(HOLIDAYS_KEY, 'null');
      const settings = loadWorkCalendarSettings();
      assert.deepStrictEqual(settings, {
        workdays: [1, 2, 3, 4, 5],
        holidays: []
      });
    });
  });

  describe('saveToLS & loadFromLS', () => {
    it('saves and loads project data correctly', () => {
      const testData = { id: 'proj1', name: 'Test Project', tasks: [] };
      saveToLS(testData);
      const loaded = loadFromLS();
      assert.deepStrictEqual(loaded, testData);
    });

    it('returns null when loadFromLS reads non-existent key or invalid JSON', () => {
      assert.strictEqual(loadFromLS(), null);

      globalThis.localStorage.setItem('ganttpro_v1', 'bad json');
      assert.strictEqual(loadFromLS(), null);
    });
  });

  describe('getOwnerId', () => {
    it('generates, stores, and returns owner ID if not present', () => {
      const id = getOwnerId();
      assert.ok(typeof id === 'string' && id.startsWith('own_'));
      assert.strictEqual(getOwnerId(), id);
    });
  });
});
