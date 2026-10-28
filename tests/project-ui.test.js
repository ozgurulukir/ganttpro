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
      }
    }
  };
  return el;
}

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

const { onTemplateChange } = await import('../src/ui/project.js');
const { D } = await import('../src/render/deps.js');

test('Project UI — onTemplateChange safe DOM preview rendering', async () => {
  const mockPreview = createMockElement('div');
  const mockSelect = createMockElement('select');
  mockSelect.value = 'tpl_xss';

  const mockNameEl = createMockElement('input');
  mockNameEl.value = '';
  mockNameEl.select = () => {};

  mockElementsMap['templatePreview'] = mockPreview;
  mockElementsMap['pTemplate'] = mockSelect;
  mockElementsMap['pName'] = mockNameEl;
  mockElementsMap['projColorDot'] = createMockElement('div');

  D.TEMPLATES = [
    {
      id: 'tpl_xss',
      name: 'Security Test Template',
      color: '#ff0000',
      tasks: [
        { id: 1, type: 'group', parent: null, name: 'Root Group' },
        { id: 2, type: 'group', parent: 1, name: '<img src=x onerror=alert(1)> Phase 1' },
        { id: 3, type: 'group', parent: 1, name: 'Phase 2 <svg/onload=alert(2)>' },
        { id: 4, type: 'task', parent: 2, name: 'Task 1' }
      ]
    }
  ];
  D.getNextGroupColor = () => '#112233';

  onTemplateChange();

  assert.equal(mockPreview.style.display, '');

  const phaseSpan = mockPreview.children.find(c => c.tagName === 'SPAN');
  assert.ok(phaseSpan, 'SPAN element for phases exists');
  assert.equal(
    phaseSpan.textContent,
    '<img src=x onerror=alert(1)> Phase 1 → Phase 2 <svg/onload=alert(2)>'
  );
  assert.equal(phaseSpan.style.color, 'var(--t4)');

  const boldEl = mockPreview.children.find(c => c.tagName === 'B');
  assert.ok(boldEl, 'B element for title exists');
});
