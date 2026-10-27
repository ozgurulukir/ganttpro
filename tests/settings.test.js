import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVersionList } from '../src/ui/settings.js';
import { D } from '../src/render/deps.js';

function createMockElement(id) {
  const children = [];
  let _innerHTML = '';
  return {
    id,
    className: '',
    get innerHTML() {
      return _innerHTML;
    },
    set innerHTML(val) {
      _innerHTML = val;
      children.length = 0;
    },
    appendChild(child) {
      children.push(child);
      _innerHTML += child.innerHTML || '';
    }
  };
}

test('renderVersionList - escapes HTML in version name, date, taskCount, and id', () => {
  const elements = {};
  const verListEl = createMockElement('verList');
  elements['verList'] = verListEl;

  global.document = {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = createMockElement(id);
      }
      return elements[id];
    },
    createElement(tag) {
      return createMockElement(tag);
    }
  };

  const mockVersion = {
    id: '<script>alert("id")</script>',
    name: '<img src=x onerror=alert("name")>',
    createdAt: '2023-01-01T00:00:00Z',
    taskCount: '<b onmouseover=alert("taskCount")>5</b>'
  };

  D.curProj = () => ({
    versions: [mockVersion]
  });

  renderVersionList();

  const html = verListEl.innerHTML;

  assert.ok(!html.includes('<script>alert("id")</script>'));
  assert.ok(!html.includes('<img src=x onerror=alert("name")>'));
  assert.ok(!html.includes('<b onmouseover=alert("taskCount")>5</b>'));

  assert.ok(html.includes('&lt;script&gt;alert(&quot;id&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(&quot;name&quot;)&gt;'));
  assert.ok(html.includes('&lt;b onmouseover=alert(&quot;taskCount&quot;)&gt;5&lt;/b&gt;'));
});
