/** Show a real plain-text post preview with optional ownership controls. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { displayFont, focusRing } from '../utils/styles';

const accents = ['border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500'];

/** Render the first 120 characters, author, and UTC publication date.
 * @param {object} props Post, display order, and optional current session.
 * @returns {JSX.Element} Linked card; edit is visible only to owners or admins.
 * Notes: Edit visibility is not a security boundary; later routes enforce ownership.
 */
export function BlogCard({ post, index = 0, session = null }) {
  const canEdit = session?.role === 'admin'
    || (session?.role === 'user' && session.userId === post.authorId);
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(post.createdAt));

  return (
    <article
      className={`flex h-full flex-col rounded-2xl border border-slate-200 border-t-4 bg-white p-6 shadow-sm ${accents[index % 4]}`}
    >
      <time dateTime={post.createdAt} className="text-sm text-slate-500">
        {date}
      </time>
      <h3 className={`${displayFont} mt-4 break-words text-2xl leading-tight text-slate-900`}>
        <Link to={`/blog/${encodeURIComponent(post.id)}`} className={`${focusRing} rounded hover:text-indigo-700`}>
          {post.title}
        </Link>
      </h3>
      <p className="mt-3 break-words text-sm leading-7 text-slate-600">
        {post.content.slice(0, 120)}
        {post.content.length > 120 ? '…' : ''}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        <p className="break-words text-sm font-medium text-slate-700">
          By {post.authorName}
        </p>
        {canEdit && (
          <Link
            to={`/edit/${encodeURIComponent(post.id)}`}
            aria-label={`Edit ${post.title}`}
            className={`${focusRing} inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-indigo-700 hover:bg-indigo-50`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
              <path d="m14 5 5 5" />
            </svg>
            Edit
          </Link>
        )}
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
