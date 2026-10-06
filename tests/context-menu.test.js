import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { D } from '../src/render/deps.js';
import { initContextMenu, showContextMenu } from '../src/ui/context-menu.js';

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
    },
    querySelector(sel) {
      if (sel === '.ctx-menu-item') {
        return children.find(c => c.classList && c.classList.contains('ctx-menu-item')) || null;
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.ctx-menu-item') {
        return children.filter(c => c.classList && c.classList.contains('ctx-menu-item'));
      }
      return [];
    },
    contains(target) {
      return children.includes(target) || target === el;
    }
  };
  return el;
}

test('Context Menu — ARIA semantics and keyboard navigation', async t => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  const docListeners = {};
  const body = createMockElement('body');

  globalThis.document = {
    body,
    createElement: tag => createMockElement(tag),
    addEventListener: (evt, fn) => {
      if (!docListeners[evt]) docListeners[evt] = [];
      docListeners[evt].push(fn);
    }
  };
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768
  };

  D.openEditModal = () => {};
  D.addTaskInline = () => {};
  D.indentTask = () => {};
  D.outdentTask = () => {};
  D.showStatus = () => {};
  D.confirmDeleteTask = () => {};

  initContextMenu();
  const menuEl = body.children[0];

  await t.test('initContextMenu sets role="menu" on container', () => {
    assert.equal(menuEl.getAttribute('role'), 'menu');
    assert.equal(menuEl.classList.contains('ctx-menu'), true);
  });

  await t.test('showContextMenu populates items with role="menuitem" and tabindex="0"', () => {
    showContextMenu(100, 100, 'task-1');
    const items = menuEl.querySelectorAll('.ctx-menu-item');
    assert.ok(items.length > 0);

    for (const itemEl of items) {
      assert.equal(itemEl.getAttribute('role'), 'menuitem');
      assert.equal(itemEl.getAttribute('tabindex'), '0');
    }
  });

  await t.test('keyboard ArrowDown/ArrowUp navigates focus between menu items', () => {
    showContextMenu(100, 100, 'task-1');
    const items = menuEl.querySelectorAll('.ctx-menu-item');

    // ArrowDown on item 0 should focus item 1
    let defaultPrevented = false;
    items[0].dispatchEvent({
      type: 'keydown',
      key: 'ArrowDown',
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {}
    });
    assert.equal(defaultPrevented, true);
    assert.equal(items[1].focused, true);

    // ArrowUp on item 0 should wrap around and focus last item
    defaultPrevented = false;
    items[0].dispatchEvent({
      type: 'keydown',
      key: 'ArrowUp',
      preventDefault: () => {
        defaultPrevented = true;
      },
      stopPropagation: () => {}
    });
    assert.equal(defaultPrevented, true);
    assert.equal(items[items.length - 1].focused, true);
  });

  await t.test('keyboard Enter / Space triggers item callback', () => {
    let editModalOpened = false;
    D.openEditModal = () => {
      editModalOpened = true;
    };

    showContextMenu(100, 100, 'task-1');
    const items = menuEl.querySelectorAll('.ctx-menu-item');

    items[0].dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.equal(editModalOpened, true);
  });

  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
});
