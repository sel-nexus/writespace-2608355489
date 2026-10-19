/** Create or edit plain-text writing with inline validation and no cancel writes. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { isValidSession } from '../utils/auth';
import { canManagePost, createPost, findPost, updatePost, validatePost } from '../utils/posts';
import { buttonStyles, displayFont, fieldStyle } from '../utils/styles';

/** Prefill edits and keep validation separate from persisted mutations.
 * @param {object} props Current identity and whether this route edits a post.
 * @returns {JSX.Element} Accessible form, not-found state, or redirect.
 */
export default function WriteBlog({ session = null, editing = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = editing ? findPost(id) : null;
  const [title, setTitle] = useState(post?.title ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    const selected = editing ? findPost(id) : null;
    setTitle(selected?.title ?? '');
    setContent(selected?.content ?? '');
    setErrors({});
    setError('');
  }, [id, editing]);

  /** Save valid fields and navigate only after the helper rereads persistence.
   * @param {Event} event Native form submission.
   * @returns {void}
   */
  function handleSubmit(event) {
    event.preventDefault();
    const fields = { title, content };
    const validation = validatePost(fields);
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) return;
    try {
      const stored = editing ? updatePost(session, id, fields) : createPost(session, fields);
      navigate(`/blog/${encodeURIComponent(stored.id)}`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  /** Update one draft field and clear only its stale validation message.
   * @param {string} field Changed field.
   * @param {string} value Draft value.
   * @returns {void}
   */
  function changeField(field, value) {
    if (field === 'title') setTitle(value);
    else setContent(value);
    setErrors((previous) => ({ ...previous, [field]: '' }));
    setError('');
  }

  if (!isValidSession(session)) return <Navigate to="/login" replace />;
  if (editing && post && !canManagePost(session, post)) return <Navigate to="/blogs" replace />;
  if (editing && !post) {
    return (
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-20">
        <h1 className={`${displayFont} text-4xl text-slate-900`}>Post not found</h1>
        <Link to="/blogs" className={`${buttonStyles.ghost} mt-6`}>Back to All Posts</Link>
      </main>
    );
  }
  const cancelTo = editing ? `/blog/${encodeURIComponent(id)}` : '/blogs';
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-6 py-12 md:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">Room for your words</p>
      <h1 className={`${displayFont} mt-4 text-4xl text-slate-900`}>{editing ? 'Edit Post' : 'Write New Post'}</h1>
      <p className="mt-4 text-slate-600">Plain text, saved in this browser. Non-sensitive demo writing only.</p>
      <form aria-label={editing ? 'Edit Post' : 'Write New Post'} onSubmit={handleSubmit} noValidate className="mt-10 space-y-6">
        <FormField
          id="title" label="Title" required value={title} error={errors.title}
          onChange={(event) => changeField('title', event.target.value)}
        />
        <div className="space-y-2">
          <label htmlFor="content" className="block text-sm font-medium text-slate-800">Content *</label>
          <textarea
            id="content" required aria-required="true" aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? 'content-error content-count' : 'content-count'}
            value={content} onChange={(event) => changeField('content', event.target.value)}
            className={`${fieldStyle} min-h-64 resize-y leading-7`}
          />
          {errors.content && <p id="content-error" role="alert" className="text-sm text-red-600">{errors.content}</p>}
          <p id="content-count" role="status" aria-label="Character count" className="text-sm tabular-nums text-slate-500">
            {content.length} characters
          </p>
        </div>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <div className="flex flex-col gap-3 md:flex-row">
          <button type="submit" className={buttonStyles.primary}>Save Post</button>
          <Link to={cancelTo} className={buttonStyles.ghost}>Cancel</Link>
        </div>
      </form>
    </main>
  );
}

WriteBlog.propTypes = { session: PropTypes.object, editing: PropTypes.bool };
