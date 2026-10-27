import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { D } from '../src/render/deps.js';
import { showTT } from '../src/render/tooltip.js';

describe('showTT security & escaping', () => {
  let originalDocument;
  let originalWindow;
  let mockTooltipEl;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;

    mockTooltipEl = {
      innerHTML: '',
      classList: {
        classes: new Set(),
        add(c) {
          this.classes.add(c);
        },
        remove(c) {
          this.classes.delete(c);
        },
        contains(c) {
          return this.classes.has(c);
        }
      },
      style: { cssText: '' }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'tooltip') return mockTooltipEl;
        return null;
      },
      querySelectorAll() {
        return [];
      }
    };

    globalThis.window = {
      innerWidth: 1024,
      innerHeight: 768
    };

    D.TODAY_STR = '2026-05-01';
    D.curProj = () => null;
    D.groupBounds = () => ({ s: '2026-05-01', e: '2026-05-10' });
    D.groupProgress = () => 50;
    D.tasks = [];
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  it('escapes XSS payloads in task properties (name, start, end, wday, progress, assignee)', () => {
    const task = {
      id: 'task-1',
      type: 'task',
      name: '<script>alert("xss")</script>',
      start: '2026-05-01"><img src=x onerror=alert(1)>',
      end: '2026-05-05',
      wday: '5"<script>alert(2)</script>',
      progress: '50"<script>alert(3)</script>',
      assignee: 'Alice <b onmouseover=alert(4)>Test</b>',
      color: '#5E6AD2',
      done: false
    };

    const mockEvent = { clientX: 100, clientY: 100 };
    showTT(mockEvent, task);

    const html = mockTooltipEl.innerHTML;
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>alert("xss")</script>'));

    assert.ok(html.includes('&gt;&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'));

    assert.ok(html.includes('5&quot;&lt;script&gt;alert(2)&lt;/script&gt;d'));
    assert.ok(!html.includes('5"<script>alert(2)</script>d'));

    assert.ok(html.includes('50&quot;&lt;script&gt;alert(3)&lt;/script&gt;%'));
    assert.ok(!html.includes('50"<script>alert(3)</script>%'));

    assert.ok(html.includes('Alice &lt;b onmouseover=alert(4)&gt;Test&lt;/b&gt;'));
    assert.ok(!html.includes('<b onmouseover=alert(4)>'));

    assert.ok(mockTooltipEl.classList.contains('show'));
  });

  it('escapes XSS payloads in milestone properties', () => {
    const task = {
      id: 'ms-1',
      type: 'milestone',
      name: 'Milestone <svg/onload=alert(1)>',
      date: '2026-05-05"><script>alert(2)</script>',
      assignee: 'Bob <iframe src="javascript:alert(3)"></iframe>'
    };

    const mockEvent = { clientX: 100, clientY: 100 };
    showTT(mockEvent, task);

    const html = mockTooltipEl.innerHTML;
    assert.ok(html.includes('Milestone &lt;svg/onload=alert(1)&gt;'));
    assert.ok(!html.includes('<svg/onload=alert(1)>'));

    assert.ok(html.includes('2026-05-05&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>alert(2)</script>'));

    assert.ok(
      html.includes('Bob &lt;iframe src=&quot;javascript:alert(3)&quot;&gt;&lt;/iframe&gt;')
    );
    assert.ok(!html.includes('<iframe'));
  });

  it('escapes XSS payloads in group bounds and progress properties', () => {
    D.groupBounds = () => ({
      s: '2026-05-01"><script>alert("s")</script>',
      e: '2026-05-10"><script>alert("e")</script>'
    });
    D.groupProgress = () => '75"<script>alert("p")</script>';

    const task = {
      id: 'grp-1',
      type: 'group',
      name: 'Group <img src=x onerror=alert(1)>',
      color: '#10B981'
    };

    const mockEvent = { clientX: 100, clientY: 100 };
    showTT(mockEvent, task);

    const html = mockTooltipEl.innerHTML;
    assert.ok(html.includes('Group &lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'));

    assert.ok(
      html.includes('2026-05-01&quot;&gt;&lt;script&gt;alert(&quot;s&quot;)&lt;/script&gt;')
    );
    assert.ok(
      html.includes('2026-05-10&quot;&gt;&lt;script&gt;alert(&quot;e&quot;)&lt;/script&gt;')
    );

    assert.ok(html.includes('75&quot;&lt;script&gt;alert(&quot;p&quot;)&lt;/script&gt;%'));
  });
});
