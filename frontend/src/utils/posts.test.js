/** Verify post business rules against real browser storage and failure boundaries. */
import { describe, expect, it, vi } from 'vitest';
import { getPosts, savePosts, saveUsers } from './storage';
import {
  canManagePost, createPost, deletePost, findPost, formatPostDate,
  getAuthorRole, listPosts, updatePost, validatePost,
} from './posts';

const owner = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const other = { ...owner, userId: 'other' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const fields = { title: 'A title', content: '  First line\n\nSecond line  ' };
const existing = {
  id: 'existing', ...fields, createdAt: '2025-01-01T00:00:00.000Z', authorId: 'writer', authorName: 'Original Writer',
};

/** Seed valid stored state without bypassing the real storage layer.
 * @returns {void}
 */
function seed() {
  savePosts([existing]);
}

/** Exercise the requested mutation with shared valid arguments.
 * @param {string} operation Mutation name.
 * @param {object|null} session Identity under test.
 * @returns {object} Mutation result.
 */
function mutate(operation, session = owner) {
  if (operation === 'create') return createPost(session, fields);
  if (operation === 'update') return updatePost(session, existing.id, fields);
  return deletePost(session, existing.id);
}

describe('post business rules', () => {
  it.each(['user', 'admin'])('creates a persisted UUID post for %s and rereads state without memory caching', (role) => {
    const session = role === 'admin' ? admin : owner;
    const record = createPost(session, { ...fields, title: ' A title ' });
    expect(record).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i), title: 'A title', content: fields.content,
      createdAt: expect.any(String), authorId: session.userId, authorName: session.displayName,
    });
    expect(Number.isFinite(Date.parse(record.createdAt))).toBe(true);
    expect(getPosts()).toEqual([record]);
    expect(findPost(record.id)).toEqual(record);
    localStorage.setItem('writespace_posts', '[]');
    expect(findPost(record.id)).toBeNull();
    expect(listPosts()).toEqual([]);
  });

  it.each([owner, admin])('updates only editable fields and rereads external changes for $role', (session) => {
    seed();
    const unrelated = { ...existing, id: 'unrelated', authorId: 'other' };
    savePosts([existing, unrelated]);
    const updated = updatePost(session, existing.id, { title: ' Changed ', content: 'New\n content' });
    expect(updated).toEqual({ ...existing, title: 'Changed', content: 'New\n content' });
    expect(getPosts()).toEqual([updated, unrelated]);
    expect(findPost(existing.id)).toEqual(updated);
  });

  it.each([owner, admin])('deletes authorized records and verifies stored removal for $role', (session) => {
    seed();
    expect(deletePost(session, existing.id)).toEqual(existing);
    expect(getPosts()).toEqual([]);
    expect(findPost(existing.id)).toBeNull();
  });

  it.each([null, {}, [], { ...owner, role: 'guest' }, { ...owner, username: '' }, { ...admin, displayName: ' ' }])(
    'fails closed for invalid identity %j on all mutations', (session) => {
      seed();
      for (const operation of ['create', 'update', 'delete']) {
        expect(() => mutate(operation, session)).toThrow('Sign in');
        expect(getPosts()).toEqual([existing]);
      }
      expect(canManagePost(session, existing)).toBe(false);
    },
  );

  it('rejects wrong ownership while admin can manage every post; absent posts are not manageable', () => {
    seed();
    expect(canManagePost(owner, existing)).toBe(true);
    expect(canManagePost(admin, existing)).toBe(true);
    expect(canManagePost(other, existing)).toBe(false);
    expect(canManagePost(admin, null)).toBe(false);
    expect(() => updatePost(other, existing.id, fields)).toThrow('cannot manage');
    expect(() => deletePost(other, existing.id)).toThrow('cannot manage');
    expect(getPosts()).toEqual([existing]);
  });

  it.each([undefined, null, '', ' ', 4, {}, 'missing'])('rejects missing/nonexistent ID %j without writes', (id) => {
    seed();
    expect(findPost(id)).toBeNull();
    expect(() => updatePost(owner, id, fields)).toThrow('Post not found');
    expect(() => deletePost(admin, id)).toThrow('Post not found');
    expect(getPosts()).toEqual([existing]);
  });

  it.each([undefined, null, {}, { title: ' ', content: '\n' }, { title: 3, content: [] }, { title: {}, content: null }])(
    'rejects invalid required fields %j without writes', (invalid) => {
      seed();
      expect(validatePost(invalid)).toEqual({ title: 'Title is required.', content: 'Content is required.' });
      expect(() => createPost(owner, invalid)).toThrow('required');
      expect(() => updatePost(owner, existing.id, invalid)).toThrow('required');
      expect(getPosts()).toEqual([existing]);
    },
  );

  it.each(['title', 'content'])('returns only the invalid %s field error', (field) => {
    expect(Object.keys(validatePost({ ...fields, [field]: '' }))).toEqual([field]);
    expect(validatePost(fields)).toEqual({});
  });

  it.each(['{broken', 'null', '{}', '[{}]', '[1]', '"text"'])('never overwrites corrupt raw storage %s', (raw) => {
    localStorage.setItem('writespace_posts', raw);
    expect(listPosts()).toEqual([]);
    for (const operation of ['create', 'update', 'delete']) {
      expect(() => mutate(operation)).toThrow('read posts safely');
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
    }
  });

  it('rejects ambiguous duplicate IDs before writing', () => {
    savePosts([existing, existing]);
    const raw = localStorage.getItem('writespace_posts');
    expect(() => createPost(owner, fields)).toThrow('read posts safely');
    expect(() => updatePost(owner, existing.id, fields)).toThrow('read posts safely');
    expect(() => deletePost(owner, existing.id)).toThrow('read posts safely');
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  });

  it.each(['create', 'update', 'delete'])('reports inaccessible storage on %s and keeps original records', (operation) => {
    seed();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    expect(listPosts()).toEqual([]);
    expect(() => mutate(operation)).toThrow('read posts safely');
    spy.mockRestore();
    expect(getPosts()).toEqual([existing]);
  });

  it.each(['create', 'update', 'delete'])('reports quota failure on %s without changing stored state', (operation) => {
    seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => mutate(operation)).toThrow('Could not save posts');
    expect(getPosts()).toEqual([existing]);
  });

  it.each(['throw', undefined, '', 'invalid', existing.id])('rejects UUID failure %j without saving', (result) => {
    seed();
    vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => {
      if (result === 'throw') throw new Error('UUID unavailable');
      return result;
    });
    expect(() => createPost(owner, fields)).toThrow('Could not create a post ID');
    expect(getPosts()).toEqual([existing]);
  });

  it('rejects a valid but duplicate UUID', () => {
    const id = '12345678-1234-4123-8123-123456789abc';
    savePosts([{ ...existing, id }]);
    vi.spyOn(window.crypto, 'randomUUID').mockReturnValue(id);
    expect(() => createPost(owner, fields)).toThrow('post ID');
    expect(getPosts()).toEqual([{ ...existing, id }]);
  });

  it.each(['create', 'update', 'delete'])('does not return false success for a silently discarded %s write', (operation) => {
    seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    if (operation === 'update') {
      // Existing ID alone is insufficient: verify the actual updated fields too.
      expect(() => updatePost(owner, existing.id, { title: 'Changed', content: 'Changed' })).toThrow('verify');
    } else expect(() => mutate(operation)).toThrow('verify');
    expect(getPosts()).toEqual([existing]);
  });

  it('sorts newest first, formats dates, and infers author roles without schema changes', () => {
    const newer = { ...existing, id: 'new', createdAt: '2025-03-09T12:00:00.000Z' };
    savePosts([existing, newer]);
    expect(listPosts()).toEqual([newer, existing]);
    expect(getPosts()).toEqual([existing, newer]);
    expect(formatPostDate(newer.createdAt)).toBe('Mar 09, 2025');
    expect(getAuthorRole({ authorId: 'admin' })).toBe('admin');
    expect(getAuthorRole(existing)).toBe('user');
    saveUsers([{ id: 'writer', username: 'writer', displayName: 'Writer', password: 'dummy', role: 'admin', createdAt: existing.createdAt }]);
    expect(getAuthorRole(existing)).toBe('admin');
    expect(getAuthorRole({ authorId: 'unknown' })).toBe('user');
  });
});
