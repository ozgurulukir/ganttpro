import { test, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { encodeData, decodeData } from '../src/data/share.js';

describe('encodeData & decodeData', () => {
  it('encodes an object into a URL-safe base64 string without +, /, or =', () => {
    const obj = { id: 'proj-1', name: 'Gantt Chart Project', tasks: [1, 2, 3] };
    const encoded = encodeData(obj);
    assert.ok(typeof encoded === 'string');
    assert.ok(encoded.length > 0);
    assert.equal(/[+/=]/.test(encoded), false, 'encoded string should not contain +, /, or =');
  });

  it('round-trips standard project data accurately', () => {
    const original = {
      id: 12345,
      name: 'Launch Campaign',
      tasks: [
        { id: 1, name: 'Setup', type: 'group', parent: null },
        {
          id: 2,
          name: 'Draft copy',
          type: 'task',
          parent: 1,
          start: '2026-05-01',
          end: '2026-05-05',
          progress: 50
        }
      ],
      baseline: { dates: { 2: { s: '2026-05-01', e: '2026-05-05' } } }
    };
    const encoded = encodeData(original);
    const decoded = decodeData(encoded);
    assert.deepStrictEqual(decoded, original);
  });

  it('handles unicode strings (CJK characters, emojis, symbols)', () => {
    const original = {
      name: '甘特圖專案 🚀 Gantt & Schedule',
      notes: 'Testing UTF-8 characters: こんにちは, 안녕하세요, 100% done ✓'
    };
    const encoded = encodeData(original);
    assert.ok(typeof encoded === 'string');
    assert.equal(/[+/=]/.test(encoded), false);
    const decoded = decodeData(encoded);
    assert.deepStrictEqual(decoded, original);
  });

  it('returns null on non-serializable objects (circular references, BigInt)', () => {
    const circular = {};
    circular.self = circular;
    assert.equal(encodeData(circular), null);

    const withBigInt = { amount: BigInt(9007199254740991) };
    assert.equal(encodeData(withBigInt), null);
  });

  it('handles null, primitive-wrapping objects, empty arrays, and empty objects', () => {
    assert.deepStrictEqual(decodeData(encodeData(null)), null);
    assert.deepStrictEqual(decodeData(encodeData({})), {});
    assert.deepStrictEqual(decodeData(encodeData([])), []);
    assert.deepStrictEqual(
      decodeData(encodeData({ numbers: [0, -1, 3.14159, null, true, false] })),
      {
        numbers: [0, -1, 3.14159, null, true, false]
      }
    );
  });
});
