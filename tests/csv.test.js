import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { exportCSV } from '../src/export/csv.js';
import { D } from '../src/render/deps.js';

describe('exportCSV', () => {
  let originalDocument;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let createdBlob = null;
  let mockAnchor = null;
  let revokedUrl = null;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalCreateObjectURL = globalThis.URL.createObjectURL;
    originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

    createdBlob = null;
    mockAnchor = null;
    revokedUrl = null;

    globalThis.URL.createObjectURL = blob => {
      createdBlob = blob;
      return 'blob:http://localhost/test-uuid';
    };

    globalThis.URL.revokeObjectURL = url => {
      revokedUrl = url;
    };

    globalThis.document = {
      createElement: tagName => {
        if (tagName === 'a') {
          mockAnchor = {
            download: '',
            href: '',
            clicked: false,
            click() {
              this.clicked = true;
            }
          };
          return mockAnchor;
        }
        return {};
      }
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;

    // Reset D properties
    delete D.curProj;
    delete D.tasks;
    delete D.groupBounds;
    delete D.buildDepsText;
    delete D.TODAY_STR;
  });

  it('does nothing when curProj returns null', () => {
    D.curProj = () => null;
    D.tasks = [];
    D.groupBounds = () => ({ s: '', e: '' });
    D.buildDepsText = () => '';
    D.TODAY_STR = '2026-03-30';

    exportCSV();

    assert.strictEqual(mockAnchor, null);
    assert.strictEqual(createdBlob, null);
  });

  it('exports CSV with correct structure, DFS hierarchy, and filename', async () => {
    const proj = { id: 'p1', name: 'Alpha Project' };
    const tasks = [
      { id: 1, parent: null, name: 'Phase 1', type: 'group' },
      {
        id: 2,
        parent: 1,
        name: 'Task A',
        type: 'task',
        assignee: 'Alice',
        start: '2026-04-01',
        end: '2026-04-03',
        done: false,
        progress: 50,
        deps: []
      },
      { id: 3, parent: 1, name: 'Milestone 1', type: 'milestone', date: '2026-04-03', done: true },
      {
        id: 4,
        parent: null,
        name: 'Task B, "Special"',
        type: 'task',
        assignee: 'Bob',
        start: '2026-04-06',
        end: '2026-04-07',
        done: true,
        deps: [2]
      }
    ];

    D.curProj = () => proj;
    D.tasks = tasks;
    D.TODAY_STR = '2026-03-30';
    D.groupBounds = groupId => {
      if (groupId === 1) return { s: '2026-04-01', e: '2026-04-03' };
      return { s: '', e: '' };
    };
    D.buildDepsText = (tk, rowMap) => {
      if (tk.id === 4) {
        // rowMap should map task id 2 to row 2
        const refRow = rowMap.get(2);
        return refRow ? `${refRow}` : '';
      }
      return '';
    };

    exportCSV();

    assert.ok(mockAnchor, 'Anchor element should be created');
    assert.strictEqual(mockAnchor.download, 'gantt-Alpha-Project-2026-03-30.csv');
    assert.strictEqual(mockAnchor.href, 'blob:http://localhost/test-uuid');
    assert.strictEqual(mockAnchor.clicked, true, 'Anchor click should be triggered');

    assert.ok(createdBlob, 'Blob should be created');
    assert.strictEqual(createdBlob.type, 'text/csv;charset=utf-8');

    // Verify UTF-8 BOM (0xEF, 0xBB, 0xBF)
    const arrayBuffer = await createdBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    assert.strictEqual(bytes[0], 0xef);
    assert.strictEqual(bytes[1], 0xbb);
    assert.strictEqual(bytes[2], 0xbf);

    const csvText = await createdBlob.text();
    const lines = csvText.split('\r\n');
    assert.strictEqual(lines.length, 5); // Header + 4 tasks

    // Check header
    const header = lines[0].split(',');
    assert.strictEqual(header[0], '#');
    assert.ok(header.length >= 10);

    // Row 1: Group "Phase 1" (depth 0)
    assert.ok(lines[1].includes('Phase 1'));
    assert.ok(lines[1].includes('2026-04-01'));
    assert.ok(lines[1].includes('2026-04-03'));

    // Row 2: Task A (depth 1 -> indent 2 spaces)
    assert.ok(lines[2].includes('  Task A'));
    assert.ok(lines[2].includes('Alice'));
    assert.ok(lines[2].includes('50')); // progress 50

    // Row 3: Milestone 1 (depth 1 -> indent 2 spaces)
    assert.ok(lines[3].includes('  Milestone 1'));
    assert.ok(lines[3].includes('Y')); // done Y

    // Row 4: Task B with special chars (escaped quotes)
    assert.ok(lines[4].includes('"Task B, ""Special"""'));
    assert.ok(lines[4].includes('Bob'));
    assert.ok(lines[4].includes('100')); // done = true => progress 100
    assert.ok(lines[4].includes('2')); // dependency reference to row 2
  });

  it('handles default filename when project has no name', () => {
    D.curProj = () => ({ id: 'p2' });
    D.tasks = [];
    D.TODAY_STR = '2026-03-30';
    D.groupBounds = () => ({ s: '', e: '' });
    D.buildDepsText = () => '';

    exportCSV();

    assert.strictEqual(mockAnchor.download, 'gantt-export-2026-03-30.csv');
  });

  it('revokes blob URL after timeout', async () => {
    D.curProj = () => ({ id: 'p3', name: 'Test' });
    D.tasks = [];
    D.TODAY_STR = '2026-03-30';
    D.groupBounds = () => ({ s: '', e: '' });
    D.buildDepsText = () => '';

    exportCSV();

    assert.strictEqual(revokedUrl, null);

    // Wait for the setTimeout callback (2000ms in source code)
    await new Promise(resolve => setTimeout(resolve, 2100));

    assert.strictEqual(revokedUrl, 'blob:http://localhost/test-uuid');
  });
});
