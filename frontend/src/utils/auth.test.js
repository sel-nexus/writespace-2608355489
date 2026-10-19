/** Verify demo auth validation, persistent state and explicit storage failures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getRoleHome, getSession, isValidSession, login, register, setSession } from './auth';

const writer = { userId: 'writer-id', username: 'writer', displayName: 'Writer', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const account = { id: 'writer-id', username: 'writer', displayName: 'Writer', password: 'dummy', role: 'user', createdAt: '2025-01-01T00:00:00.000Z' };
const fields = { displayName: 'New Writer', username: 'new-writer', password: 'dummy', confirmPassword: 'dummy' };

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('session persistence and validation', () => {
  it('reads missing session as guest and clear is idempotent', () => {
    expect(getSession()).toBeNull();
    clearSession();
    clearSession();
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });

  it.each([writer, admin])('saves and rereads $role identity without password or extras', (session) => {
    setSession({ ...session, password: 'never-save', extra: 'ignored' });
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
    expect(getSession()).toEqual(session);
    setSession(session.role === 'user' ? admin : writer);
    expect(getSession()).toEqual(session.role === 'user' ? admin : writer);
    clearSession();
    expect(getSession()).toBeNull();
  });

  it('rereads external storage changes without any memory fallback', () => {
    setSession(writer);
    localStorage.setItem('writespace_session', JSON.stringify(admin));
    expect(getSession()).toEqual(admin);
    localStorage.removeItem('writespace_session');
    expect(getSession()).toBeNull();
  });

  it.each(['{', 'null', '[]', 'true', '1', '"user"', '{}'])('fails closed for malformed raw session %s', (raw) => {
    localStorage.setItem('writespace_session', raw);
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });

  for (const field of ['userId', 'username', 'displayName', 'role']) {
    it.each([undefined, null, '', ' ', 0, true, [], {}])(`rejects invalid ${field} value %j on reads and writes`, (value) => {
      const invalid = { ...writer, [field]: value };
      localStorage.setItem('writespace_session', JSON.stringify(invalid));
      expect(getSession()).toBeNull();
      expect(isValidSession(invalid)).toBe(false);
      expect(() => setSession(invalid)).toThrow('invalid identity');
      expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(JSON.parse(JSON.stringify(invalid)));
    });
  }

  it.each(['Admin', 'USER', 'guest', 'owner'])('rejects unsupported role %s', (role) => {
    expect(isValidSession({ ...writer, role })).toBe(false);
    expect(() => setSession({ ...writer, role })).toThrow('invalid identity');
  });

  it.each([null, undefined, [], 'writer', 1, true])('rejects nonobject session %j', (invalid) => {
    expect(isValidSession(invalid)).toBe(false);
    expect(() => setSession(invalid)).toThrow('invalid identity');
  });

  it('fails closed for read errors even after a successful write', () => {
    setSession(writer);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getSession()).toBeNull();
  });

  it('reports failed writes and retains previous persistent session', () => {
    setSession(writer);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => setSession(admin)).toThrow('Could not save session in this browser');
    expect(getSession()).toEqual(writer);
  });

  it('reports failed clears and never pretends to log out', () => {
    setSession(writer);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => clearSession()).toThrow('Could not log out');
    expect(getSession()).toEqual(writer);
  });

  it('reports a blocked localStorage getter without memory fallback', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(getSession()).toBeNull();
    expect(() => setSession(writer)).toThrow('Could not save session');
    expect(() => clearSession()).toThrow('Could not log out');
  });

  it('routes only valid identities to role homes', () => {
    expect(getRoleHome(admin)).toBe('/admin');
    expect(getRoleHome(writer)).toBe('/blogs');
    expect(getRoleHome(null)).toBe('/login');
    expect(getRoleHome({ role: 'admin' })).toBe('/login');
  });
});

describe('login', () => {
  it('uses built-in admin first even if stored users are corrupt or conflict', () => {
    localStorage.setItem('writespace_users', '{');
    expect(login('admin', 'admin')).toEqual(admin);
    expect(getSession()).toEqual(admin);
    localStorage.setItem('writespace_users', JSON.stringify([{ ...account, username: 'admin', password: 'admin' }]));
    expect(login('admin', 'admin')).toEqual(admin);
    expect(getSession()).toEqual(admin);
    expect(() => login('admin', 'dummy')).toThrow('Invalid username or password.');
    expect(getSession()).toEqual(admin);
  });

  it.each(['user', 'admin'])('logs in a real persisted %s account and excludes its password', (role) => {
    localStorage.setItem('writespace_users', JSON.stringify([{ ...account, role }]));
    const session = { ...writer, role };
    expect(login('writer', 'dummy')).toEqual(session);
    expect(getSession()).toEqual(session);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(session);
  });

  it('rereads changed account credentials rather than caching them', () => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    login('writer', 'dummy');
    localStorage.setItem('writespace_users', JSON.stringify([{ ...account, password: 'changed' }]));
    expect(() => login('writer', 'dummy')).toThrow('Invalid username or password.');
    expect(login('writer', 'changed')).toEqual(writer);
    localStorage.removeItem('writespace_users');
    expect(() => login('writer', 'changed')).toThrow('Invalid username or password.');
  });

  it.each([['writer', 'wrong'], ['unknown', 'dummy'], ['Writer', 'dummy'], [' writer ', 'dummy'], ['admin', 'wrong']])('rejects credentials %s without mutating session', (username, password) => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    setSession(writer);
    expect(() => login(username, password)).toThrow('Invalid username or password.');
    expect(getSession()).toEqual(writer);
  });

  it.each([undefined, null, '', ' ', 1, false, [], {}])('rejects invalid credential types %j', (invalid) => {
    expect(() => login(invalid, 'dummy')).toThrow('Invalid username or password.');
    expect(() => login('writer', invalid)).toThrow('Invalid username or password.');
    expect(getSession()).toBeNull();
  });

  it.each(['{', '{}', '[{}]', '[{"role":"owner"}]', 'null'])('reports corrupted accounts %s', (raw) => {
    localStorage.setItem('writespace_users', raw);
    expect(() => login('writer', 'dummy')).toThrow('Could not read accounts');
    expect(getSession()).toBeNull();
  });

  it('reports unavailable account storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => login('writer', 'dummy')).toThrow('Could not read accounts');
  });

  it('admin bypasses account reads but still requires a successful session write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(login('admin', 'admin')).toEqual(admin);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => login('admin', 'admin')).toThrow('Could not save session');
  });

  it('does not return successful user login when session storage fails', () => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => login('writer', 'dummy')).toThrow('Could not save session');
    expect(getSession()).toBeNull();
  });
});

describe('large identity persistence', () => {
  const largeFields = {
    displayName: 'Writer 名 '.repeat(8192).trim(),
    username: `writer-${'x'.repeat(65536)}`,
    password: 'dummy-密碼 '.repeat(16384),
  };
  const largeAccounts = Array.from({ length: 128 }, (_, index) => ({
    ...account, id: `writer-${index}`, username: `writer-${index}`, displayName: 'Existing Writer '.repeat(256),
  }));

  it('registers and logs in large valid values with exact account and session rereads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T12:00:00.000Z'));
    localStorage.setItem('writespace_users', JSON.stringify(largeAccounts));
    const registered = register({ ...largeFields, confirmPassword: largeFields.password });
    const expectedSession = {
      userId: registered.userId, username: largeFields.username, displayName: largeFields.displayName, role: 'user',
    };
    const expectedUsers = [...largeAccounts, {
      id: registered.userId, displayName: largeFields.displayName, username: largeFields.username,
      password: largeFields.password, role: 'user', createdAt: '2025-03-01T12:00:00.000Z',
    }];
    const savedUsersRaw = JSON.stringify(expectedUsers);
    expect(registered).toEqual(expectedSession);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual(expectedUsers);
    expect(localStorage.getItem('writespace_users')).toBe(savedUsersRaw);
    expect(localStorage.getItem('writespace_session')).toBe(JSON.stringify(expectedSession));
    expect(getSession()).toEqual(expectedSession);
    clearSession();
    expect(getSession()).toBeNull();
    expect(login(largeFields.username, largeFields.password)).toEqual(expectedSession);
    expect(getSession()).toEqual(expectedSession);
    expect(localStorage.getItem('writespace_session')).toBe(JSON.stringify(expectedSession));
    expect(localStorage.getItem('writespace_users')).toBe(savedUsersRaw);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual(expectedUsers);
  });

  it.each(['register', 'login'])('retains exact existing data when a large %s write exceeds quota', (operation) => {
    const largeAccount = { ...account, ...largeFields };
    const existingUsers = operation === 'login' ? [...largeAccounts, largeAccount] : largeAccounts;
    localStorage.setItem('writespace_users', JSON.stringify(existingUsers));
    setSession(writer);
    const usersRaw = localStorage.getItem('writespace_users');
    const sessionRaw = localStorage.getItem('writespace_session');
    const original = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (value.length > 32768) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    const attempt = operation === 'register'
      ? () => register({ ...largeFields, confirmPassword: largeFields.password })
      : () => login(largeFields.username, largeFields.password);
    expect(attempt).toThrow(operation === 'register' ? 'Could not save accounts' : 'Could not save session');
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0][0]).toBe(operation === 'register' ? 'writespace_users' : 'writespace_session');
    expect(writes.mock.calls[0][1].length).toBeGreaterThan(32768);
    expect(localStorage.getItem('writespace_users')).toBe(usersRaw);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual(existingUsers);
    expect(localStorage.getItem('writespace_session')).toBe(sessionRaw);
    expect(getSession()).toEqual(writer);
  });
});

describe('registration', () => {
  it('saves a trimmed unique UUID writer with timestamp and reread session, ignoring a requested admin role', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T12:00:00.000Z'));
    const session = register({ ...fields, displayName: ' New Writer ', username: ' new-writer ', role: 'admin' });
    expect(session.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(session).toEqual({ userId: session.userId, username: 'new-writer', displayName: 'New Writer', role: 'user' });
    expect(getSession()).toEqual(session);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([
      { id: session.userId, username: 'new-writer', displayName: 'New Writer', password: 'dummy', role: 'user', createdAt: '2025-03-01T12:00:00.000Z' },
    ]);
  });

  it('appends without losing persisted users and assigns distinct IDs on subsequent registrations', () => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    const first = register(fields);
    const second = register({ ...fields, username: 'another-writer' });
    const users = JSON.parse(localStorage.getItem('writespace_users'));
    expect(users).toHaveLength(3);
    expect(users[0]).toEqual(account);
    expect(second.userId).not.toBe(first.userId);
    expect(getSession()).toEqual(second);
    expect(() => register(fields)).toThrow('Username is already taken.');
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual(users);
  });

  for (const field of ['displayName', 'username', 'password', 'confirmPassword']) {
    it.each([undefined, null, '', ' ', 1, false, [], {}])(`requires a nonblank string ${field}: %j`, (invalid) => {
      expect(() => register({ ...fields, [field]: invalid })).toThrow('All fields are required.');
      expect(localStorage.getItem('writespace_users')).toBeNull();
      expect(getSession()).toBeNull();
    });
  }

  it.each([undefined, null, [], 'writer', 1, false])('rejects missing or nonobject form %j', (invalid) => {
    expect(() => register(invalid)).toThrow('All fields are required.');
    expect(localStorage.getItem('writespace_users')).toBeNull();
  });

  it('requires exact matching passwords without trimming passwords', () => {
    expect(() => register({ ...fields, confirmPassword: 'dummy ' })).toThrow('Passwords must match.');
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_users')).toBeNull();
    register({ ...fields, password: ' dummy ', confirmPassword: ' dummy ' });
    expect(() => login('new-writer', 'dummy')).toThrow('Invalid username or password.');
    expect(login('new-writer', ' dummy ').role).toBe('user');
  });

  it.each(['admin', 'Admin', ' ADMIN '])('always reserves built-in username %s', (username) => {
    localStorage.setItem('writespace_users', '{');
    expect(() => register({ ...fields, username })).toThrow('Username is already taken.');
    expect(localStorage.getItem('writespace_users')).toBe('{');
    expect(getSession()).toBeNull();
  });

  it.each(['writer', 'Writer', ' writer '])('rejects persisted duplicate %s without changes', (username) => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    setSession(writer);
    expect(() => register({ ...fields, username })).toThrow('Username is already taken.');
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([account]);
    expect(getSession()).toEqual(writer);
  });

  it.each(['{', '{}', '[{}]', 'null', '[{"id":"broken"}]'])('does not overwrite corrupt accounts %s', (raw) => {
    localStorage.setItem('writespace_users', raw);
    expect(() => register(fields)).toThrow('Could not read accounts');
    expect(localStorage.getItem('writespace_users')).toBe(raw);
    expect(getSession()).toBeNull();
  });

  it('reports blocked account reads before attempting registration', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => register(fields)).toThrow('Could not read accounts');
  });

  it('reports UUID failure without persisting anything', () => {
    vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => { throw new Error('unsupported'); });
    expect(() => register(fields)).toThrow('Could not create an account ID');
    expect(localStorage.getItem('writespace_users')).toBeNull();
    expect(getSession()).toBeNull();
  });

  it('reports account write failure and retains existing state', () => {
    localStorage.setItem('writespace_users', JSON.stringify([account]));
    setSession(writer);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => register(fields)).toThrow('Could not save accounts');
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([account]);
    expect(getSession()).toEqual(writer);
  });

  it('reports session write failure explicitly while retaining the saved account for login retry', () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'writespace_session') throw new Error('quota');
      return original.call(this, key, value);
    });
    expect(() => register(fields)).toThrow('Could not save session');
    expect(getSession()).toBeNull();
    expect(JSON.parse(localStorage.getItem('writespace_users'))[0]).toMatchObject({ username: 'new-writer', role: 'user' });
    vi.restoreAllMocks();
    expect(login('new-writer', 'dummy')).toEqual(getSession());
  });
});
