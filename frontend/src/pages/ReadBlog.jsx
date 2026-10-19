/** Read full plain text and offer ownership-limited post actions. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { isValidSession } from '../utils/auth';
import { canManagePost, deletePost, findPost, formatPostDate, getAuthorRole } from '../utils/posts';
import { buttonStyles, displayFont } from '../utils/styles';

/** Render the selected post, preserving whitespace and escaping text through React.
 * @param {object} props Current identity.
 * @returns {JSX.Element} Reader, not-found state, or guest redirect.
 */
export default function ReadBlog({ session = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const post = findPost(id);

  /** Confirm deletion, then enforce permission again in the mutation helper.
   * @returns {void}
   */
  function handleDelete() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      deletePost(session, id);
      navigate('/blogs');
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (!isValidSession(session)) return <Navigate to="/login" replace />;
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-12 md:py-20">
      <Link to="/blogs" className={buttonStyles.ghost}>Back to All Posts</Link>
      {post ? (
        <article className="mx-auto mt-8 max-w-3xl">
          <header className="border-b border-slate-200 pb-8">
            <h1 className={`${displayFont} break-words text-4xl leading-tight text-slate-900 md:text-5xl`}>{post.title}</h1>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <Avatar role={getAuthorRole(post)} />
              <span className="break-words font-medium">{post.authorName}</span>
              <time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time>
            </div>
          </header>
          <div className="mt-8 whitespace-pre-wrap break-words text-lg leading-8 text-slate-800">{post.content}</div>
          {canManagePost(session, post) && (
            <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
              <Link to={`/edit/${encodeURIComponent(post.id)}`} className={buttonStyles.secondary}>Edit</Link>
              <button type="button" onClick={handleDelete} className={buttonStyles.destructive}>Delete</button>
            </div>
          )}
        </article>
      ) : (
        <h1 className={`${displayFont} mt-8 text-4xl text-slate-900`}>Post not found</h1>
      )}
      {error && <p role="alert" className="mt-6 text-red-600">{error}</p>}
    </main>
  );
}

ReadBlog.propTypes = { session: PropTypes.object };
