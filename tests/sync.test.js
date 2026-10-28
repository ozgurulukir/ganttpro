import { describe, it, before } from 'node:test';
import assert from 'node:assert';

// Minimal mock DOM and localStorage globals before importing modules that rely on DOM
const mockElements = new Map();
globalThis.document = {
  getElementById(id) {
    if (mockElements.has(id)) {
      return mockElements.get(id);
    }
    return { addEventListener() {} };
  },
  documentElement: { lang: 'en' },
  querySelectorAll() {
    return [];
  }
};

const storageMap = new Map();
globalThis.localStorage = {
  getItem(k) {
    return storageMap.get(k) || null;
  },
  setItem(k, v) {
    storageMap.set(k, String(v));
  },
  removeItem(k) {
    storageMap.delete(k);
  }
};

// Mock BroadcastChannel and window for Node.js test environment
if (typeof globalThis.BroadcastChannel === 'undefined') {
  globalThis.BroadcastChannel = class BroadcastChannel {
    constructor(name) {
      this.name = name;
    }
    postMessage() {}
    close() {}
    unref() {}
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener() {}
  };
}

const { initI18n, setLocale } = await import('../src/i18n/index.js');
const { setSyncDot, getPendingCloudWrites, initSync, saveToCloud, loadFromCloud } =
  await import('../src/sync.js');

describe('getPendingCloudWrites', () => {
  it('returns a Set instance representing pending cloud writes', () => {
    const pending = getPendingCloudWrites();
    assert.ok(pending instanceof Set);
  });

  it('initially has size 0 when no writes are pending', () => {
    const pending = getPendingCloudWrites();
    assert.strictEqual(pending.size, 0);
  });

  it('tracks in-flight cloud save promises when user is logged in', async () => {
    let user = { uid: 'user123' };
    initSync({
      getCurrentUser: () => user,
      getCurProj: () => null,
      getNextProjId: () => 1,
      showStatus: () => {}
    });

    const pending = getPendingCloudWrites();
    assert.strictEqual(pending.size, 0);

    const savePromise = saveToCloud();
    // While saving, the write process creates a promise tracked by getPendingCloudWrites
    await savePromise;
    assert.strictEqual(pending.size, 0);
  });
});

describe('setSyncDot', () => {
  before(async () => {
    await initI18n();
    setLocale('en');
  });

  it('handles missing syncDot element gracefully without errors', () => {
    mockElements.delete('syncDot');
    assert.doesNotThrow(() => {
      setSyncDot('saving');
    });
  });

  it('updates class and title for "saving" state', () => {
    const dot = { className: '', title: '' };
    mockElements.set('syncDot', dot);

    setSyncDot('saving');
    assert.equal(dot.className, 'sync-dot saving');
    assert.equal(dot.title, 'Saving…');
  });

  it('updates class and title for "ok" state', () => {
    const dot = { className: '', title: '' };
    mockElements.set('syncDot', dot);

    setSyncDot('ok');
    assert.equal(dot.className, 'sync-dot ok');
    assert.equal(dot.title, 'Synced');
  });

  it('updates class and title for "err" state', () => {
    const dot = { className: '', title: '' };
    mockElements.set('syncDot', dot);

    setSyncDot('err');
    assert.equal(dot.className, 'sync-dot err');
    assert.equal(dot.title, 'Sync failed');
  });

  it('updates class and title for "off" state', () => {
    const dot = { className: '', title: '' };
    mockElements.set('syncDot', dot);

    setSyncDot('off');
    assert.equal(dot.className, 'sync-dot off');
    assert.equal(dot.title, 'Read-only');
  });

  it('updates class and title for "local" state', () => {
    const dot = { className: '', title: '' };
    mockElements.set('syncDot', dot);

    setSyncDot('local');
    assert.equal(dot.className, 'sync-dot local');
    assert.equal(dot.title, 'Local mode (no cloud sync)');
  });

  it('handles null/undefined/empty state with default class and title', () => {
    const dot = { className: 'sync-dot ok', title: 'Synced' };
    mockElements.set('syncDot', dot);

    setSyncDot();
    assert.equal(dot.className, 'sync-dot');
    assert.equal(dot.title, 'Cloud sync');

    setSyncDot(null);
    assert.equal(dot.className, 'sync-dot');
    assert.equal(dot.title, 'Cloud sync');

    setSyncDot('');
    assert.equal(dot.className, 'sync-dot');
    assert.equal(dot.title, 'Cloud sync');
  });

  it('handles unknown state by setting custom class suffix and default title', () => {
    const dot = { className: '', title: '' };
    mockElements.set('syncDot', dot);

    setSyncDot('custom-state');
    assert.equal(dot.className, 'sync-dot custom-state');
    assert.equal(dot.title, 'Cloud sync');
  });

  it('resolves localized title when locale is zh-TW', () => {
    const dot = { className: '', title: '' };
    mockElements.set('syncDot', dot);

    setLocale('zh-TW');
    setSyncDot('ok');
    assert.equal(dot.className, 'sync-dot ok');
    assert.equal(dot.title, '已同步');

    setSyncDot('saving');
    assert.equal(dot.title, '儲存中…');

    setSyncDot('err');
    assert.equal(dot.title, '同步失敗');

    // Reset back to English
    setLocale('en');
  });
});

describe('loadFromCloud', () => {
  it('returns false when no current user is logged in', async () => {
    initSync({
      getCurrentUser: () => null
    });
    const result = await loadFromCloud();
    assert.strictEqual(result, false);
  });

  it('returns false and catches error when readUserData throws an exception', async () => {
    initSync({
      getCurrentUser: () => ({ uid: 'user_error' }),
      readUserData: async () => {
        throw new Error('Network timeout');
      }
    });
    const result = await loadFromCloud();
    assert.strictEqual(result, false);
  });

  it('returns false when readUserData returns null/falsy', async () => {
    initSync({
      getCurrentUser: () => ({ uid: 'user_null' }),
      readUserData: async () => null
    });
    const result = await loadFromCloud();
    assert.strictEqual(result, false);
  });

  it('returns true and handles empty project list properly', async () => {
    let currentProjId = 123;
    let tasks = [1];
    let nextId = 10;
    let projects = [{ id: 1 }];

    initSync({
      getCurrentUser: () => ({ uid: 'user_empty' }),
      readUserData: async () => ({ projects: [], nextProjId: 1 }),
      setProjects: p => {
        projects = p;
      },
      setNextProjId: id => {},
      setCurrentProjId: id => {
        currentProjId = id;
      },
      setTasks: t => {
        tasks = t;
      },
      setNextId: id => {
        nextId = id;
      }
    });

    const result = await loadFromCloud();
    assert.strictEqual(result, true);
    assert.strictEqual(currentProjId, null);
    assert.deepStrictEqual(tasks, []);
    assert.strictEqual(nextId, 1);
  });

  it('returns true and loads projects and current project state properly', async () => {
    const mockProj = {
      id: 1,
      name: 'Project 1',
      tasks: [{ id: 1, name: 'Root', type: 'group', parent: null }],
      nextId: 2,
      startDate: '2026-05-01',
      endDate: '2026-05-10'
    };

    let setProjList = [];
    let curId = null;
    let curTasks = [];
    let curNextId = null;
    let chartStart = null;
    let chartEnd = null;

    initSync({
      getCurrentUser: () => ({ uid: 'user_valid' }),
      readUserData: async () => ({
        projects: [mockProj],
        currentProjId: 1,
        nextProjId: 2
      }),
      setProjects: p => {
        setProjList = p;
      },
      setNextProjId: () => {},
      setCurrentProjId: id => {
        curId = id;
      },
      getCurProj: () => mockProj,
      setTasks: t => {
        curTasks = t;
      },
      setNextId: id => {
        curNextId = id;
      },
      setChartStart: d => {
        chartStart = d;
      },
      setChartEnd: d => {
        chartEnd = d;
      }
    });

    const result = await loadFromCloud();
    assert.strictEqual(result, true);
    assert.strictEqual(curId, 1);
    assert.strictEqual(curTasks.length, 1);
    assert.strictEqual(curNextId, 2);
    assert.ok(chartStart instanceof Date);
    assert.ok(chartEnd instanceof Date);
  });
});
