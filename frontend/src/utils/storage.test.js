/** Verify schema validation and real browser-storage state for both record lists. */
import { describe, expect, it, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers } from './storage';

const post = {
  id: 'post-1', title: 'A thought', content: 'Plain text',
  createdAt: '2025-01-02T12:00:00.000Z', authorId: 'user-1', authorName: 'Alex',
};
const user = {
  id: 'user-1', displayName: 'Alex', username: 'alex', password: 'dummy-only',
  role: 'user', createdAt: '2025-01-01T12:00:00.000Z',
};

for (const [label, key, read, save, record, fields] of [
  ['posts', 'writespace_posts', getPosts, savePosts, post, ['id', 'title', 'content', 'authorId', 'authorName']],
  ['accounts', 'writespace_users', getUsers, saveUsers, user, ['id', 'displayName', 'username', 'password']],
]) {
  describe(label, () => {
    it('returns empty for missing storage without seeding it', () => {
      expect(read()).toEqual([]);
      expect(localStorage.getItem(key)).toBeNull();
    });

    it.each(['{broken', 'undefined', 'null', '{}', '42', 'true', '"text"'])
    ('returns empty for malformed JSON or non-list data: %s', (raw) => {
      localStorage.setItem(key, raw);
      expect(read()).toEqual([]);
      expect(localStorage.getItem(key)).toBe(raw);
    });

    it.each([null, 1, true, 'record', [], {}])('rejects an invalid record: %j', (invalid) => {
      localStorage.setItem(key, JSON.stringify([record, invalid]));
      expect(read()).toEqual([]);
      expect(() => save([record, invalid])).toThrow(`Could not save ${label}: some records are invalid.`);
    });

    for (const field of fields) {
      it(`rejects a missing ${field}`, () => {
        const invalid = { ...record };
        delete invalid[field];
        localStorage.setItem(key, JSON.stringify([invalid]));
        expect(read()).toEqual([]);
        expect(() => save([invalid])).toThrow(/records are invalid/);
      });

      it.each([null, 23, false, {}, [], '', '   '])(`rejects invalid ${field}: %j`, (value) => {
        const invalid = { ...record, [field]: value };
        localStorage.setItem(key, JSON.stringify([invalid]));
        expect(read()).toEqual([]);
        expect(() => save([invalid])).toThrow(/records are invalid/);
      });
    }

    it.each([undefined, null, 42, {}, [], '', ' ', 'not-a-date'])
    ('rejects an unusable createdAt: %j', (createdAt) => {
      const invalid = { ...record, createdAt };
      localStorage.setItem(key, JSON.stringify([invalid]));
      expect(read()).toEqual([]);
      expect(() => save([invalid])).toThrow(/records are invalid/);
    });

    it('reads valid stored data and saves replacement records that can be reread', () => {
      localStorage.setItem(key, JSON.stringify([record]));
      expect(read()).toEqual([record]);
      const replacement = { ...record, id: 'replacement' };
      save([replacement]);
      expect(JSON.parse(localStorage.getItem(key))).toEqual([replacement]);
      expect(read()).toEqual([replacement]);
      save([]);
      expect(read()).toEqual([]);
      expect(localStorage.getItem(key)).toBe('[]');
    });

    it.each([undefined, null, {}, 'records', 3, false])('refuses a non-list write: %j', (value) => {
      save([record]);
      expect(() => save(value)).toThrow(/records are invalid/);
      expect(read()).toEqual([record]);
    });

    it('catches getItem exceptions and does not remember previous reads', () => {
      save([record]);
      expect(read()).toEqual([record]);
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
      expect(read()).toEqual([]);
    });

    it('catches storage property access exceptions', () => {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
      expect(read()).toEqual([]);
      expect(() => save([record])).toThrow(`Could not save ${label} in this browser.`);
    });

    it.each(['QuotaExceededError', 'SecurityError'])('reports %s without a memory fallback', (name) => {
      save([record]);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Cannot save', name);
      });
      expect(() => save([{ ...record, id: 'unsaved' }])).toThrow(
        `Could not save ${label} in this browser. Check available storage and try again.`,
      );
      expect(read()).toEqual([record]);
    });

    it('reports serialization errors and preserves the previously saved list', () => {
      save([record]);
      const circular = { ...record };
      circular.extra = circular;
      expect(() => save([circular])).toThrow(/Check available storage and try again/);
      expect(read()).toEqual([record]);
    });
  });
}

describe('account roles and key isolation', () => {
  it.each([undefined, null, '', 'Admin', 'owner', 1, {}, []])('rejects invalid account role %j', (role) => {
    localStorage.setItem('writespace_users', JSON.stringify([{ ...user, role }]));
    expect(getUsers()).toEqual([]);
    expect(() => saveUsers([{ ...user, role }])).toThrow(/records are invalid/);
  });

  it('accepts both internal roles and never writes unrelated storage keys', () => {
    localStorage.setItem('writespace_session', 'untouched');
    saveUsers([user, { ...user, id: 'admin-1', username: 'demo-admin', role: 'admin' }]);
    savePosts([post]);
    expect(getUsers().map((account) => account.role)).toEqual(['user', 'admin']);
    expect(getPosts()).toEqual([post]);
    expect(localStorage.getItem('writespace_session')).toBe('untouched');
  });
});
