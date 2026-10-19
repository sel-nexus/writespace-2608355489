/** Persist validated demo records in localStorage; never retain a memory fallback.
 * Notes: Accounts contain plaintext demo passwords, not secure credentials.
 * @typedef {{id:string, title:string, content:string, createdAt:string, authorId:string, authorName:string}} Post
 * @typedef {{id:string, displayName:string, username:string, password:string, role:'admin'|'user', createdAt:string}} User
 */
const postFields = ['id', 'title', 'content', 'authorId', 'authorName'];
const userFields = ['id', 'displayName', 'username', 'password'];

/** Check required strings, a usable timestamp, and account roles.
 * @param {unknown} record Candidate stored record.
 * @param {string[]} fields Required nonblank string fields.
 * @param {boolean} isUser Whether to enforce the account role contract.
 * @returns {boolean} Whether the record is safe for consumers.
 */
function validRecord(record, fields, isUser) {
  return record !== null && typeof record === 'object' && !Array.isArray(record)
    && fields.every((field) => typeof record[field] === 'string' && record[field].trim().length > 0)
    && typeof record.createdAt === 'string' && record.createdAt.trim().length > 0
    && Number.isFinite(Date.parse(record.createdAt))
    && (!isUser || record.role === 'admin' || record.role === 'user');
}

/** Validate the entire list rather than silently dropping damaged records.
 * @param {unknown} records Candidate list.
 * @param {boolean} isUser Whether this is the account list.
 * @returns {boolean} Whether every item conforms to its schema.
 */
function validList(records, isUser) {
  return Array.isArray(records)
    && records.every((record) => validRecord(record, isUser ? userFields : postFields, isUser));
}

/** Read a validated list and return an empty state on any storage exception.
 * @param {string} key Browser-local storage key.
 * @param {boolean} isUser Whether to validate accounts.
 * @returns {Array<Post>|Array<User>} Persisted records or an empty list.
 */
function readList(key, isUser) {
  try {
    const records = JSON.parse(window.localStorage.getItem(key));
    return validList(records, isUser) ? records : [];
  } catch {
    return [];
  }
}

/** Save valid records or throw a user-readable error without false success.
 * @param {string} key Browser-local storage key.
 * @param {unknown} records Complete replacement list.
 * @param {boolean} isUser Whether to validate accounts.
 * @returns {void}
 * @throws {Error} When records are invalid or browser storage cannot save.
 */
function writeList(key, records, isUser) {
  const label = isUser ? 'accounts' : 'posts';
  if (!validList(records, isUser)) {
    throw new Error(`Could not save ${label}: some records are invalid.`);
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(records));
  } catch {
    throw new Error(`Could not save ${label} in this browser. Check available storage and try again.`);
  }
}

/** Read safe post records; never throw on unavailable or corrupt storage.
 * @returns {Post[]} Validated posts or an empty list.
 */
export function getPosts() {
  return readList('writespace_posts', false);
}

/** Replace persisted posts after validating every record.
 * @param {Post[]} arr Complete post list.
 * @returns {void}
 * @throws {Error} When validation or persistence fails.
 */
export function savePosts(arr) {
  writeList('writespace_posts', arr, false);
}

/** Read safe account records; never throw on unavailable or corrupt storage.
 * @returns {User[]} Validated demo accounts or an empty list.
 */
export function getUsers() {
  return readList('writespace_users', true);
}

/** Replace plaintext demo accounts after validating every record.
 * @param {User[]} arr Complete account list; use only dummy passwords.
 * @returns {void}
 * @throws {Error} When validation or persistence fails.
 */
export function saveUsers(arr) {
  writeList('writespace_users', arr, true);
}
