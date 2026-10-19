/** Administer browser-local demo accounts. Passwords remain plaintext: never use real credentials. */
import { isValidSession } from './auth';
import { getUsers, saveUsers } from './storage';

const builtin = { id: 'admin', displayName: 'Admin', username: 'admin', role: 'admin', createdAt: null };
const labels = { displayName: 'Display Name', username: 'Username', password: 'Password' };

/** Require a complete administrator identity before reading or writing accounts.
 * @param {object|null} session Candidate identity.
 * @returns {void}
 * @throws {Error} When the identity is absent, malformed, or not an administrator.
 */
function requireAdmin(session) {
  if (!isValidSession(session)) throw new Error('Sign in to manage accounts.');
  if (session.role !== 'admin') throw new Error('Only administrators can manage accounts.');
}

/** Read actual storage and refuse corrupt, duplicate, or reserved identities.
 * @returns {object[]} Complete persisted accounts, with no memory fallback.
 * @throws {Error} When accounts cannot be read safely.
 */
function readAccounts() {
  try {
    const raw = window.localStorage.getItem('writespace_users');
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    const accounts = getUsers();
    if (!Array.isArray(parsed) || JSON.stringify(parsed) !== JSON.stringify(accounts)
      || accounts.some((account) => account.id === 'admin' || account.username.trim().toLowerCase() === 'admin')
      || new Set(accounts.map((account) => account.id)).size !== accounts.length
      || new Set(accounts.map((account) => account.username.trim().toLowerCase())).size !== accounts.length) {
      throw new Error('Invalid accounts');
    }
    return accounts;
  } catch {
    throw new Error('Could not read accounts safely. Restore browser storage before saving.');
  }
}

/** Validate each required field and the supported role without mutation.
 * @param {unknown} fields Candidate account fields.
 * @returns {object} Accessible field messages.
 */
export function validateUser(fields) {
  const errors = {};
  for (const [field, label] of Object.entries(labels)) {
    if (typeof fields?.[field] !== 'string' || !fields[field].trim()) errors[field] = `${label} is required.`;
  }
  if (fields?.role !== 'admin' && fields?.role !== 'user') errors.role = 'Role must be Admin or user.';
  return errors;
}

/** List the fixed built-in account and freshly read registered accounts.
 * @param {object} session Current administrator identity.
 * @returns {object[]} Displayable accounts; built-in has no invented timestamp or password.
 * @throws {Error} When access or storage is invalid.
 */
export function listAccounts(session) {
  requireAdmin(session);
  return [{ ...builtin }, ...readAccounts()];
}

/** Save an entire account list and verify exact persisted state afterward.
 * @param {object[]} accounts Expected complete account list.
 * @returns {object[]} Reread accounts.
 * @throws {Error} When saving or verification fails.
 */
function persist(accounts) {
  saveUsers(accounts);
  const stored = readAccounts();
  if (JSON.stringify(stored) !== JSON.stringify(accounts)) throw new Error('Could not verify saved accounts.');
  return stored;
}

/** Create a unique UUID account in either role with truthful creation time.
 * @param {object} session Administrator identity.
 * @param {object} fields Display name, username, plaintext demo password, and role.
 * @returns {object} Reread persisted account.
 * @throws {Error} When access, validation, UUID generation, or storage fails.
 */
export function createUser(session, fields) {
  requireAdmin(session);
  const errors = validateUser(fields);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
  const accounts = readAccounts();
  const username = fields.username.trim();
  if (username.toLowerCase() === 'admin'
    || accounts.some((account) => account.username.trim().toLowerCase() === username.toLowerCase())) {
    throw new Error('Username is already taken.');
  }
  let id;
  try {
    id = window.crypto.randomUUID();
    if (typeof id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      || id === 'admin' || accounts.some((account) => account.id === id)) throw new Error('Invalid UUID');
  } catch {
    throw new Error('Could not create an account ID. Use a modern secure-context browser and try again.');
  }
  const account = { id, displayName: fields.displayName.trim(), username, password: fields.password,
    role: fields.role, createdAt: new Date().toISOString() };
  return persist([...accounts, account]).find((record) => record.id === id);
}

/** Delete an eligible account, protecting the built-in and current identity.
 * @param {object} session Administrator identity.
 * @param {string} id Requested account identity.
 * @returns {object} Removed account from the pre-write read.
 * @throws {Error} When access, protection, existence, or persistence fails.
 */
export function deleteUser(session, id) {
  requireAdmin(session);
  if (id === 'admin') throw new Error('Default admin cannot be deleted.');
  if (id === session.userId) throw new Error('You cannot delete your current account.');
  const accounts = readAccounts();
  const account = typeof id === 'string' && id.trim() ? accounts.find((record) => record.id === id) : null;
  if (!account) throw new Error('Account not found.');
  persist(accounts.filter((record) => record.id !== id));
  return account;
}
