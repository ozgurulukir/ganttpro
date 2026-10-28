import { test } from 'node:test';
import { strict as assert } from 'node:assert';

function createMockElement(tagName = 'div') {
  const listeners = {};
  const attributes = {};
  const children = [];
  const classList = new Set();

  const el = {
    getBoundingClientRect: () => ({ left: 0, bottom: 0, width: 100, height: 20 }),
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
    select() {},
    focus() {
      el.focused = true;
    },
    setAttribute(k, v) {
      attributes[k] = String(v);
    },
    getAttribute(k) {
      return attributes[k];
    },
    removeAttribute(k) {
      delete attributes[k];
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
    replaceChildren(...nodes) {
      children.length = 0;
      children.push(...nodes);
    },
    _innerHTML: '',
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(v) {
      this._innerHTML = v;
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
      },
      toggle(cls, force) {
        if (force !== undefined) {
          if (force) classList.add(cls);
          else classList.delete(cls);
          return force;
        }
        if (classList.has(cls)) {
          classList.delete(cls);
          return false;
        }
        classList.add(cls);
        return true;
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
  createTextNode: text => ({ textContent: String(text), nodeType: 3 }),
  querySelectorAll: () => []
};

// Import module after document mock setup
const { openStartEditor, openEndEditor, openModal, openEditModal, openAllDepsEditor } =
  await import('../src/ui/modal.js');
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

test('Modal — advanced options accordion updates aria-expanded on open and edit', async t => {
  D.isReadOnly = false;
  D.curProj = () => ({ id: 1, name: 'Test' });
  D.openProjModal = () => {};
  D.TODAY_STR = '2026-05-07';
  D.getAllDescendants = () => [];
  D.tasks = [];
  D.projects = [];
  D.taskById = id => ({ id, name: 'Test Task', type: 'task', link: 'https://example.com' });
  D.buildDepsText = () => '';

  await t.test('openModal sets aria-expanded to false', () => {
    openModal();
    const advToggle = getOrCreateMockById('modalAdvancedToggle');
    assert.equal(advToggle.getAttribute('aria-expanded'), 'false');
  });

  await t.test('openEditModal sets aria-expanded to true if advanced fields are present', () => {
    openEditModal(1);
    const advToggle = getOrCreateMockById('modalAdvancedToggle');
    assert.equal(advToggle.getAttribute('aria-expanded'), 'true');
  });
});

test('Modal — openAllDepsEditor escapes task count / rowNum in tooltip innerHTML', async t => {
  const cell = createMockElement('td');
  cell.getBoundingClientRect = () => ({ left: 0, bottom: 0, width: 100 });
  const task = { id: 2, name: 'Target Task' };

  let innerHTMLValue = '';
  const bodyAppended = [];
  const origAppendChild = globalThis.document.body ? globalThis.document.body.appendChild : null;
  globalThis.document.body = {
    appendChild: el => {
      bodyAppended.push(el);
      return el;
    }
  };

  D.parseDepInput = () => [{ rowNum: '<script>alert(1)</script>1', type: 'FS', taskId: 1 }];
  D.taskById = () => ({ id: 1, name: '<img src=x onerror=alert(2)>' });
  D.buildDepsText = () => '1FS';

  openAllDepsEditor(task, cell);

  const tip = bodyAppended.find(el => el.className === 'deps-tip');
  assert.ok(tip, 'deps-tip element appended to document.body');
  assert.ok(
    tip.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt;1'),
    'escapes rowNum in tip.innerHTML'
  );
  assert.ok(!tip.innerHTML.includes('<script>'), 'un-escaped script tag not present');
});

test('Project — onTemplateChange safely renders preview using DOM elements', async () => {
  const mockPreview = createMockElement('div');
  const mockSelect = createMockElement('select');
  mockSelect.value = 'tpl1';

  const mockNameEl = createMockElement('input');
  mockNameEl.value = 'Existing Name';
  mockNameEl.select = () => {};

  mockElementsMap['templatePreview'] = mockPreview;
  mockElementsMap['pTemplate'] = mockSelect;
  mockElementsMap['pName'] = mockNameEl;
  mockElementsMap['projColorDot'] = createMockElement('div');

  D.TEMPLATES = [
    {
      id: 'tpl1',
      name: 'Software Project',
      color: '#123456',
      tasks: [
        { id: 1, type: 'group', parent: null, name: 'Root' },
        { id: 2, type: 'group', parent: 1, name: 'Phase <script>alert(1)</script>' },
        { id: 3, type: 'task', parent: 2, name: 'Task 1' }
      ]
    }
  ];
  D.getNextGroupColor = () => '#654321';

  const { onTemplateChange } = await import('../src/ui/project.js');

  onTemplateChange();

  const phaseSpan = mockPreview.children.find(c => c.tagName === 'SPAN');
  assert.ok(phaseSpan, 'span element for phase names should exist');
  assert.equal(phaseSpan.textContent, 'Phase <script>alert(1)</script>');
  assert.equal(phaseSpan.style.color, 'var(--t4)');

  const boldEl = mockPreview.children.find(c => c.tagName === 'B');
  assert.ok(boldEl, 'bold element for template title should exist');
});
