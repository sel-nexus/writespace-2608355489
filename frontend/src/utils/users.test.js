/** Verify admin account validation, protections, and real-storage mutation contracts. */
import { describe, expect, it, vi } from 'vitest';
import { createUser, deleteUser, listAccounts, validateUser } from './users';
import { getUsers, saveUsers } from './storage';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const fields = { displayName: ' Demo Writer ', username: ' demo ', password: ' dummy ', role: 'user' };
const account = { id: 'local', displayName: 'Local', username: 'local', password: 'dummy', role: 'user', createdAt: '2025-01-02T00:00:00.000Z' };

/** Seed a valid account and return its persisted representation.
 * @returns {object} Account fixture.
 */
function seed() { saveUsers([account]); return account; }

describe('users service', () => {
  it('lists truthful built-in metadata plus actual persisted accounts on every query', () => {
    expect(listAccounts(admin)).toEqual([{ id: 'admin', username: 'admin', displayName: 'Admin', role: 'admin', createdAt: null }]);
    seed();
    const result = listAccounts(admin);
    expect(result[1]).toEqual(account);
    result[0].displayName = 'Changed';
    saveUsers([]);
    expect(listAccounts(admin)[0].displayName).toBe('Admin');
    expect(listAccounts(admin)).toHaveLength(1);
  });

  it.each(['user', 'admin'])('creates %s role UUID/date, trims names, preserves plaintext password and requeries', (role) => {
    const created = createUser(admin, { ...fields, role, id: 'admin', createdAt: 'invented' });
    expect(created).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/i), displayName: 'Demo Writer', username: 'demo', password: ' dummy ', role, createdAt: expect.any(String) });
    expect(Number.isFinite(Date.parse(created.createdAt))).toBe(true);
    expect(getUsers()).toEqual([created]);
    expect(listAccounts(admin)).toHaveLength(2);
  });

  it.each(['displayName', 'username', 'password', 'role'])('rejects invalid values/types in %s before writing', (field) => {
    for (const value of [undefined, null, '', '   ', 17, true, [], {}, () => {}]) {
      expect(validateUser({ ...fields, [field]: value })).toHaveProperty(field);
      expect(() => createUser(admin, { ...fields, [field]: value })).toThrow();
      expect(localStorage.getItem('writespace_users')).toBeNull();
    }
  });

  it.each([null, undefined, 4, [], {}])('validates invalid field container %j', (value) => {
    expect(Object.keys(validateUser(value))).toHaveLength(4);
    expect(() => createUser(admin, value)).toThrow();
  });

  it.each(['Admin', 'guest', 'owner'])('rejects unsupported role %s', (role) => {
    expect(() => createUser(admin, { ...fields, role })).toThrow('Role must be Admin or user.');
  });

  it.each([null, {}, [], { role: 'admin' }, { ...admin, userId: 4 }, { ...admin, displayName: '' }, { ...admin, username: null }, { ...admin, role: 'guest' }, { ...admin, role: 'user' }])('rejects identity %j before storage access for all operations', (session) => {
    const reads = vi.spyOn(Storage.prototype, 'getItem');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    for (const action of [() => listAccounts(session), () => createUser(session, fields), () => deleteUser(session, 'local')]) expect(action).toThrow();
    expect(reads).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(['admin', ' ADMIN ', 'LOCAL', ' local '])('rejects unique/reserved username %s without mutation', (username) => {
    seed();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(() => createUser(admin, { ...fields, username })).toThrow('Username is already taken.');
    expect(writes).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([account]);
  });

  it('deletes eligible accounts and requeries storage, preserving other accounts', () => {
    seed();
    const second = createUser(admin, fields);
    expect(deleteUser(admin, 'local')).toEqual(account);
    expect(getUsers()).toEqual([second]);
    expect(listAccounts(admin).map((item) => item.id)).toEqual(['admin', second.id]);
  });

  it.each(['admin', 'local'])('protects built-in/current account %s in the service', (id) => {
    seed();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(() => deleteUser({ ...admin, userId: 'local' }, id)).toThrow(id === 'admin' ? 'Default admin cannot be deleted.' : 'You cannot delete your current account.');
    expect(writes).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([account]);
  });

  it.each(['missing', '', null, undefined, 1, {}, []])('rejects missing/invalid resource %j', (id) => {
    seed();
    expect(() => deleteUser(admin, id)).toThrow('Account not found.');
    expect(getUsers()).toEqual([account]);
  });

  it.each(['{broken', '{}', '[{}]', 'null', JSON.stringify([{ ...account, id: 'admin' }]), JSON.stringify([{ ...account, username: ' ADMIN ' }]), JSON.stringify([account, account]), JSON.stringify([account, { ...account, id: 'other', username: ' LOCAL ' }])])('rejects corrupt/ambiguous data %s before writes', (raw) => {
    localStorage.setItem('writespace_users', raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(() => listAccounts(admin)).toThrow('Could not read accounts safely.');
    expect(() => createUser(admin, fields)).toThrow('Could not read accounts safely.');
    expect(() => deleteUser(admin, 'local')).toThrow('Could not read accounts safely.');
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_users')).toBe(raw);
  });

  it('reports blocked reads with no memory fallback or writes', () => {
    seed();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(() => listAccounts(admin)).toThrow('Could not read accounts safely.');
    expect(() => createUser(admin, fields)).toThrow('Could not read accounts safely.');
    expect(() => deleteUser(admin, 'local')).toThrow('Could not read accounts safely.');
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(['throw', undefined, 4, 'admin', 'not-uuid', '00000000-0000-4000-8000-000000000000'])('rejects unavailable/invalid/colliding UUID %j', (value) => {
    saveUsers([{ ...account, id: '00000000-0000-4000-8000-000000000000' }]);
    vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => { if (value === 'throw') throw new Error('Missing'); return value; });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    expect(() => createUser(admin, fields)).toThrow('Could not create an account ID.');
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(['user', 'admin'])('U06 persists large exact strings and %s role, then preserves accounts on large quota failure', (role) => {
    seed();
    const largeFields = {
      displayName: `  ${'Large Writer 文'.repeat(8192)}  `,
      username: `  ${'large-writer-'.repeat(8192)}  `,
      password: `  ${'demo password 🔒\n'.repeat(16384)}  `,
      role,
    };
    const created = createUser(admin, largeFields);
    expect(created.displayName).toBe(largeFields.displayName.trim());
    expect(created.username).toBe(largeFields.username.trim());
    expect(created.password).toBe(largeFields.password);
    expect(created.role).toBe(role);
    const previous = [account, created];
    expect(getUsers()).toEqual(previous);
    const raw = localStorage.getItem('writespace_users');
    expect(JSON.parse(raw)).toEqual(previous);
    expect(listAccounts(admin).slice(1)).toEqual(previous);

    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const rejectedFields = { ...largeFields, username: `${largeFields.username.trim()}-quota` };
    expect(() => createUser(admin, rejectedFields)).toThrow('Could not save accounts');
    expect(writes).toHaveBeenCalledWith('writespace_users', expect.any(String));
    const attempted = JSON.parse(writes.mock.calls[0][1]);
    expect(attempted.slice(0, 2)).toEqual(previous);
    expect(attempted[2]).toMatchObject({
      displayName: rejectedFields.displayName.trim(),
      username: rejectedFields.username,
      password: rejectedFields.password,
      role,
    });
    expect(localStorage.getItem('writespace_users')).toBe(raw);
    expect(getUsers()).toEqual(previous);
    expect(listAccounts(admin).slice(1)).toEqual(previous);
  });

  it.each(['create', 'delete'])('reports %s quota failure without false persistence', (operation) => {
    seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => operation === 'create' ? createUser(admin, fields) : deleteUser(admin, 'local')).toThrow('Could not save accounts');
    expect(getUsers()).toEqual([account]);
  });

  it.each(['create', 'delete'])('detects silently discarded %s write on requery', (operation) => {
    seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    expect(() => operation === 'create' ? createUser(admin, fields) : deleteUser(admin, 'local')).toThrow('Could not verify saved accounts.');
    expect(getUsers()).toEqual([account]);
  });

  it('detects modified saved content rather than merely checking the generated ID', () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      const records = JSON.parse(value); records[0].displayName = 'Unexpected';
      original.call(this, key, JSON.stringify(records));
    });
    expect(() => createUser(admin, fields)).toThrow('Could not verify saved accounts.');
  });
});
