/** Validate and mutate browser-local plain-text posts without a memory repository. */
import { isValidSession } from './auth';
import { getPosts, getUsers, savePosts } from './storage';

/** Return field-level errors without mutating input.
 * @param {unknown} fields Candidate title and content.
 * @returns {object} Required-field messages keyed by field.
 */
export function validatePost(fields) {
  const errors = {};
  for (const field of ['title', 'content']) {
    if (typeof fields?.[field] !== 'string' || !fields[field].trim()) {
      errors[field] = `${field === 'title' ? 'Title' : 'Content'} is required.`;
    }
  }
  return errors;
}

/** Check role and ownership with a fail-closed session contract.
 * @param {object|null} session Current browser identity.
 * @param {object|null} post Selected post.
 * @returns {boolean} Whether this identity may modify the post.
 */
export function canManagePost(session, post) {
  return isValidSession(session) && Boolean(post)
    && (session.role === 'admin' || session.userId === post.authorId);
}

/** Infer the avatar role without adding fields to persisted posts.
 * @param {object} post Author-bearing record.
 * @returns {string} Built-in or registered author role, defaulting to user.
 */
export function getAuthorRole(post) {
  return post?.authorId === 'admin' ? 'admin'
    : getUsers().find((user) => user.id === post?.authorId)?.role ?? 'user';
}

/** Format a stored publication date consistently in UTC.
 * @param {string} createdAt Valid publication timestamp.
 * @returns {string} Publication date in MMM DD, YYYY form.
 */
export function formatPostDate(createdAt) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(createdAt));
}

/** Reread all posts in newest-first order.
 * @returns {object[]} Safe persisted records, never a cached array.
 */
export function listPosts() {
  return getPosts().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Reread a single post, returning null for absent or invalid IDs.
 * @param {unknown} id Requested post identity.
 * @returns {object|null} Stored post or not-found state.
 */
export function findPost(id) {
  return typeof id === 'string' && id.trim() ? getPosts().find((post) => post.id === id) ?? null : null;
}

/** Refuse to replace corrupted, ambiguous, or inaccessible stored records.
 * @returns {object[]} Complete validated persisted list.
 * @throws {Error} When storage is not safe to mutate.
 */
function readWritablePosts() {
  try {
    const raw = window.localStorage.getItem('writespace_posts');
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    const posts = getPosts();
    if (!Array.isArray(parsed) || posts.length !== parsed.length
      || new Set(posts.map((post) => post.id)).size !== posts.length) throw new Error('Invalid posts');
    return posts;
  } catch {
    throw new Error('Could not read posts safely. Restore browser storage before saving.');
  }
}

/** Reject guest identities and invalid fields before any write.
 * @param {object|null} session Current identity.
 * @param {object} fields Optional fields to validate.
 * @returns {void}
 * @throws {Error} When identity or fields are invalid.
 */
function requireInput(session, fields) {
  if (!isValidSession(session)) throw new Error('Sign in to manage posts.');
  if (fields !== undefined && Object.keys(validatePost(fields)).length) {
    throw new Error('Title and content are required.');
  }
}

/** Create a UUID post with current authorship and reread its stored record.
 * @param {object} session Valid current identity.
 * @param {object} fields Required title and plain-text content.
 * @returns {object} Persisted post.
 * @throws {Error} When validation, storage, or UUID generation fails.
 */
export function createPost(session, fields) {
  requireInput(session, fields ?? null);
  const posts = readWritablePosts();
  let id;
  try {
    id = window.crypto.randomUUID();
    if (typeof id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      || posts.some((post) => post.id === id)) throw new Error('Invalid UUID');
  } catch {
    throw new Error('Could not create a post ID. Use a modern secure-context browser and try again.');
  }
  const post = {
    id, title: fields.title.trim(), content: fields.content, createdAt: new Date().toISOString(),
    authorId: session.userId, authorName: session.displayName,
  };
  savePosts([...posts, post]);
  const stored = readWritablePosts().find((record) => record.id === id);
  if (!stored) throw new Error('Could not verify the saved post.');
  return stored;
}

/** Update only title and content, preserving original authorship and creation metadata.
 * @param {object} session Current identity.
 * @param {string} id Existing post identity.
 * @param {object} fields Required replacement fields.
 * @returns {object} Reread persisted record.
 * @throws {Error} When identity, ownership, fields, or storage are invalid.
 */
export function updatePost(session, id, fields) {
  requireInput(session, fields ?? null);
  const posts = readWritablePosts();
  const post = posts.find((record) => record.id === id);
  if (!post) throw new Error('Post not found');
  if (!canManagePost(session, post)) throw new Error('You cannot manage this post.');
  savePosts(posts.map((record) => record.id === id
    ? { ...record, title: fields.title.trim(), content: fields.content } : record));
  const stored = readWritablePosts().find((record) => record.id === id);
  if (!stored || stored.title !== fields.title.trim() || stored.content !== fields.content) {
    throw new Error('Could not verify the saved post.');
  }
  return stored;
}

/** Remove an authorized post and verify persisted removal.
 * @param {object} session Current identity.
 * @param {string} id Existing post identity.
 * @returns {object} Removed record from the pre-write storage read.
 * @throws {Error} When identity, ownership, existence, or storage fails.
 */
export function deletePost(session, id) {
  requireInput(session);
  const posts = readWritablePosts();
  const post = posts.find((record) => record.id === id);
  if (!post) throw new Error('Post not found');
  if (!canManagePost(session, post)) throw new Error('You cannot manage this post.');
  savePosts(posts.filter((record) => record.id !== id));
  if (readWritablePosts().some((record) => record.id === id)) throw new Error('Could not verify post deletion.');
  return post;
}
