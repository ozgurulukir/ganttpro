import { test, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  encodeData,
  decodeData,
  getOrCreateShareToken,
  SHARE_MAX_BYTES
} from '../src/data/share.js';
import { validateProject } from '../src/core/validate.js';

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

describe('getOrCreateShareToken', () => {
  it('returns existing shareToken if already set on project', () => {
    const proj = { id: 101, name: 'Test Proj', shareToken: 'existing_token_123' };
    const token = getOrCreateShareToken(proj);
    assert.equal(token, 'existing_token_123');
    assert.equal(proj.shareToken, 'existing_token_123');
  });

  it('generates, assigns, and returns a new shareToken when missing', () => {
    const proj = { id: 102, name: 'New Proj' };
    const token = getOrCreateShareToken(proj);

    assert.equal(typeof token, 'string');
    assert.ok(token.length > 0);
    assert.equal(proj.shareToken, token);
  });

  it('generates a new token when shareToken is null or empty string', () => {
    const projNull = { id: 103, shareToken: null };
    const projEmpty = { id: 104, shareToken: '' };

    const tokenNull = getOrCreateShareToken(projNull);
    const tokenEmpty = getOrCreateShareToken(projEmpty);

    assert.ok(typeof tokenNull === 'string' && tokenNull.length > 0);
    assert.ok(typeof tokenEmpty === 'string' && tokenEmpty.length > 0);
    assert.equal(projNull.shareToken, tokenNull);
    assert.equal(projEmpty.shareToken, tokenEmpty);
  });

  it('is idempotent: repeated calls return the same token and do not re-generate', () => {
    const proj = { id: 105 };
    const firstCall = getOrCreateShareToken(proj);
    const secondCall = getOrCreateShareToken(proj);
    const thirdCall = getOrCreateShareToken(proj);

    assert.equal(firstCall, secondCall);
    assert.equal(secondCall, thirdCall);
    assert.equal(proj.shareToken, firstCall);
  });

  it('generates unique tokens for distinct project objects', () => {
    const projA = { id: 201 };
    const projB = { id: 202 };

    const tokenA = getOrCreateShareToken(projA);
    const tokenB = getOrCreateShareToken(projB);

    assert.notEqual(tokenA, tokenB);
  });

  it('generates tokens in valid URL-safe base64 format without +, /, or =', () => {
    for (let i = 0; i < 20; i++) {
      const proj = {};
      const token = getOrCreateShareToken(proj);
      assert.match(token, /^[A-Za-z0-9_-]+$/);
      assert.equal(token.includes('+'), false);
      assert.equal(token.includes('/'), false);
      assert.equal(token.includes('='), false);
    }
  });

  it('generated token satisfies validateProject shareToken format regex', () => {
    const proj = { id: 1, name: 'Project 1', tasks: [] };
    getOrCreateShareToken(proj);

    const validRegex = /^[A-Za-z0-9_-]{1,100}$/;
    assert.ok(
      validRegex.test(proj.shareToken),
      `Token "${proj.shareToken}" should match validateProject regex`
    );

    const sanitized = validateProject(proj);
    assert.notEqual(sanitized, null);
    assert.equal(sanitized.shareToken, proj.shareToken);
  });

  it('correctly transforms binary values to URL-safe characters using crypto mock', () => {
    const originalGetRandomValues = crypto.getRandomValues;
    try {
      crypto.getRandomValues = buffer => {
        const mockBytes = [
          251, 255, 191, 255, 254, 253, 252, 251, 250, 249, 248, 247, 246, 245, 244, 243
        ];
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = mockBytes[i % mockBytes.length];
        }
        return buffer;
      };

      const proj = {};
      const token = getOrCreateShareToken(proj);

      assert.equal(token.includes('+'), false);
      assert.equal(token.includes('/'), false);
      assert.equal(token.includes('='), false);
      assert.match(token, /^[A-Za-z0-9_-]+$/);
    } finally {
      crypto.getRandomValues = originalGetRandomValues;
    }
  });
});

describe('encodeData & decodeData', () => {
  it('correctly exports SHARE_MAX_BYTES constant', () => {
    assert.equal(SHARE_MAX_BYTES, 256 * 1024);
  });

  it('encodes and decodes complex project data objects accurately', () => {
    const original = {
      id: 'proj_99',
      name: '甘特圖專案 Gantt Chart 🚀',
      tasks: [
        { id: 1, name: 'Task 1', start: '2026-05-01', wday: 5 },
        { id: 2, name: '任務二', start: '2026-05-06', wday: 3, deps: [1] }
      ],
      settings: { zoom: 'day', darkMode: true }
    };

    const encoded = encodeData(original);
    assert.equal(typeof encoded, 'string');
    assert.match(encoded, /^[A-Za-z0-9_-]+$/);

    const decoded = decodeData(encoded);
    assert.deepEqual(decoded, original);
  });

  it('returns null when encodeData fails on circular references', () => {
    const circular = {};
    circular.self = circular;
    assert.equal(encodeData(circular), null);
  });

  it('returns null when decodeData encounters invalid or corrupted base64 string', () => {
    const origConsoleError = console.error;
    try {
      console.error = () => {};
      assert.equal(decodeData('!!!invalid_b64!!!'), null);
      assert.equal(decodeData(null), null);
    } finally {
      console.error = origConsoleError;
    }
  });
});
