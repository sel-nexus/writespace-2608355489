/** Manage browser-local demo identity. Plaintext passwords and client guards are not secure authentication.
 * @typedef {{userId:string, username:string, displayName:string, role:'admin'|'user'}} Session
 */
import { getUsers, saveUsers } from './storage';

const sessionKey = 'writespace_session';
const sessionFields = ['userId', 'username', 'displayName'];

/** Check every required identity field and the two supported roles.
 * @param {unknown} session Candidate identity.
 * @returns {boolean} Whether the identity is usable.
 */
export function isValidSession(session) {
  return session !== null && typeof session === 'object' && !Array.isArray(session)
    && sessionFields.every((field) => typeof session[field] === 'string' && session[field].trim().length > 0)
    && (session.role === 'admin' || session.role === 'user');
}

/** Reread persisted identity, failing closed on malformed or unavailable storage.
 * @returns {Session|null} Valid identity or guest state.
 */
export function getSession() {
  try {
    const session = JSON.parse(window.localStorage.getItem(sessionKey));
    return isValidSession(session) ? session : null;
  } catch {
    return null;
  }
}

/** Persist only session fields, never account passwords.
 * @param {Session} session Valid local identity.
 * @returns {void}
 * @throws {Error} When validation or storage fails.
 */
export function setSession(session) {
  if (!isValidSession(session)) throw new Error('Could not save session: invalid identity.');
  const { userId, username, displayName, role } = session;
  try {
    window.localStorage.setItem(sessionKey, JSON.stringify({ userId, username, displayName, role }));
  } catch {
    throw new Error('Could not save session in this browser. Check available storage and try again.');
  }
}

/** Remove persisted identity; leave callers signed in when removal fails.
 * @returns {void}
 * @throws {Error} When storage cannot clear the session.
 */
export function clearSession() {
  try {
    window.localStorage.removeItem(sessionKey);
  } catch {
    throw new Error('Could not log out in this browser. Check storage access and try again.');
  }
}

/** Choose the role home only for valid identities.
 * @param {Session|null} session Current identity.
 * @returns {string} Administrator home, blog home, or login.
 */
export function getRoleHome(session) {
  if (!isValidSession(session)) return '/login';
  return session.role === 'admin' ? '/admin' : '/blogs';
}

/** Read accounts without overwriting corrupt or inaccessible data during registration.
 * @returns {Array<object>} Valid persisted accounts.
 * @throws {Error} When stored accounts cannot be read safely.
 */
function readAccounts() {
  try {
    const raw = window.localStorage.getItem('writespace_users');
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    const users = getUsers();
    if (!Array.isArray(parsed) || users.length !== parsed.length) throw new Error('Invalid accounts');
    return users;
  } catch {
    throw new Error('Could not read accounts in this browser. Check storage access and try again.');
  }
}

/** Authenticate built-in admin first, then real persisted accounts, and persist identity.
 * @param {string} username Exact demo username.
 * @param {string} password Exact plaintext demo password.
 * @returns {Session} Persisted session.
 * @throws {Error} When credentials or storage are invalid.
 */
export function login(username, password) {
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password.trim()) {
    throw new Error('Invalid username or password.');
  }
  let session;
  if (username === 'admin' && password === 'admin') {
    session = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
  } else {
    const account = readAccounts().find((user) => user.username === username && user.password === password);
    if (!account || username === 'admin') throw new Error('Invalid username or password.');
    session = { userId: account.id, username: account.username, displayName: account.displayName, role: account.role };
  }
  setSession(session);
  return session;
}

/** Register a unique writer with UUID and timestamp; never accept a supplied role.
 * Notes: If the account saves but the session fails, the account remains available for a login retry.
 * @param {object} fields Display name, username, password and confirmation.
 * @returns {Session} Persisted writer session.
 * @throws {Error} When validation, UUID generation, or persistence fails.
 */
export function register(fields) {
  const { displayName, username, password, confirmPassword } = fields ?? {};
  if (![displayName, username, password, confirmPassword].every((value) => typeof value === 'string' && value.trim())) {
    throw new Error('All fields are required.');
  }
  if (password !== confirmPassword) throw new Error('Passwords must match.');
  const name = username.trim();
  if (name.toLowerCase() === 'admin') throw new Error('Username is already taken.');
  const users = readAccounts();
  if (users.some((user) => user.username.toLowerCase() === name.toLowerCase())) {
    throw new Error('Username is already taken.');
  }
  let id;
  try {
    id = window.crypto.randomUUID();
  } catch {
    throw new Error('Could not create an account ID. Use a modern secure-context browser and try again.');
  }
  const account = { id, displayName: displayName.trim(), username: name, password, role: 'user', createdAt: new Date().toISOString() };
  saveUsers([...users, account]);
  const session = { userId: id, username: name, displayName: account.displayName, role: 'user' };
  setSession(session);
  return session;
}
