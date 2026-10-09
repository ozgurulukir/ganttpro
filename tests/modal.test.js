import { test } from 'node:test';
import { strict as assert } from 'node:assert';

function createMockElement(tagName = 'div') {
  const listeners = {};
  const attributes = {};
  const children = [];
  const classList = new Set();

  const el = {
    tagName: tagName.toUpperCase(),
    style: {},
    children,
    listeners,
    attributes,
    focused: false,
    value: '',
    type: '',
    get className() {
      return Array.from(classList).join(' ');
    },
    set className(v) {
      classList.clear();
      if (v) v.split(' ').forEach(c => c && classList.add(c));
    },
    focus() {
      el.focused = true;
    },
    setAttribute(k, v) {
      attributes[k] = String(v);
    },
    getAttribute(k) {
      return attributes[k];
    },
    addEventListener(evt, fn) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(fn);
    },
    dispatchEvent(event) {
      const fnList = listeners[event.type] || [];
      for (const fn of fnList) {
        fn(event);
      }
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    get innerHTML() {
      return '';
    },
    set innerHTML(v) {
      if (v === '') children.length = 0;
    },
    classList: {
      add(cls) {
        classList.add(cls);
      },
      remove(cls) {
        classList.delete(cls);
      },
      contains(cls) {
        return classList.has(cls);
      }
    }
  };
  return el;
}

// Setup minimal document mock before importing modal.js
const mockElementsMap = {};
function getOrCreateMockById(id) {
  if (!mockElementsMap[id]) {
    mockElementsMap[id] = createMockElement('div');
  }
  return mockElementsMap[id];
}

globalThis.document = {
  getElementById: id => getOrCreateMockById(id),
  createElement: tag => createMockElement(tag),
  querySelectorAll: () => []
};

// Import module after document mock setup
const { openStartEditor, openEndEditor } = await import('../src/ui/modal.js');
const { D } = await import('../src/render/deps.js');

test('Modal — openStartEditor and openEndEditor handle showPicker warnings and changes', async t => {
  const originalConsoleWarn = console.warn;

  let cell;
  let task;
  let appliedChange = null;
  let renderCalled = false;
  let warnLogs = [];

  t.beforeEach(() => {
    cell = createMockElement('td');
    task = { id: 1, start: '2025-01-01', end: '2025-01-05' };
    appliedChange = null;
    renderCalled = false;
    warnLogs = [];

    console.warn = (...args) => {
      warnLogs.push(args);
    };

    D.applyTaskChange = (t, patch) => {
      appliedChange = { task: t, patch };
    };

    D.render = () => {
      renderCalled = true;
    };
  });

  t.afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  await t.test(
    'openStartEditor creates input, handles showPicker failure gracefully, and commits change on blur',
    () => {
      openStartEditor(task, cell);

      const inp = cell.children[0];
      assert.ok(inp, 'input created');
      assert.equal(inp.type, 'date');
      assert.equal(inp.value, '2025-01-01');

      // Attach mock showPicker that throws
      inp.showPicker = () => {
        throw new Error('Not supported');
      };

      // Simulate input date change and blur
      inp.value = '2025-01-02';
      inp.dispatchEvent({ type: 'blur' });

      assert.ok(appliedChange, 'applyTaskChange was called');
      assert.equal(appliedChange.task, task);
      assert.equal(appliedChange.patch.start, '2025-01-02');
    }
  );

  await t.test(
    'openStartEditor logs a warning when showPicker throws during editor opening',
    () => {
      const origCreate = globalThis.document.createElement;
      globalThis.document.createElement = tag => {
        const el = createMockElement(tag);
        if (tag === 'input') {
          el.showPicker = () => {
            throw new Error('Picker disabled');
          };
        }
        return el;
      };

      openStartEditor(task, cell);

      assert.equal(warnLogs.length, 1);
      assert.equal(warnLogs[0][0], 'showPicker failed:');
      assert.equal(warnLogs[0][1].message, 'Picker disabled');

      globalThis.document.createElement = origCreate;
    }
  );

  await t.test(
    'openEndEditor creates input, logs warning on showPicker failure, and commits end date change on blur',
    () => {
      const origCreate = globalThis.document.createElement;
      globalThis.document.createElement = tag => {
        const el = createMockElement(tag);
        if (tag === 'input') {
          el.showPicker = () => {
            throw new Error('End picker error');
          };
        }
        return el;
      };

      openEndEditor(task, cell);

      assert.equal(warnLogs.length, 1);
      assert.equal(warnLogs[0][0], 'showPicker failed:');

      const inp = cell.children[0];
      assert.ok(inp, 'input created');
      assert.equal(inp.type, 'date');
      assert.equal(inp.value, '2025-01-05');

      inp.value = '2025-01-10';
      inp.dispatchEvent({ type: 'blur' });

      assert.ok(appliedChange, 'applyTaskChange was called for end date');
      assert.equal(appliedChange.patch.end, '2025-01-10');

      globalThis.document.createElement = origCreate;
    }
  );
});
