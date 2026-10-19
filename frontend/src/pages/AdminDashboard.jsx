/** Show real local overview counts and administrator controls for the newest posts. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { isValidSession } from '../utils/auth';
import { deletePost, formatPostDate, listPosts } from '../utils/posts';
import { listAccounts } from '../utils/users';
import { buttonStyles, displayFont } from '../utils/styles';

/** Reread overview data and delete any author's post only after confirmation.
 * @param {object} props Current browser identity.
 * @returns {JSX.Element} Administrator overview or fail-closed redirect.
 */
export default function AdminDashboard({ session = null }) {
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (!isValidSession(session) || session.role !== 'admin') return;
    setPosts(listPosts());
    try { setAccounts(listAccounts(session)); }
    catch (failure) { setError(failure.message); }
  }, [session]);

  /** Confirm removal, then requery actual storage and report failures explicitly.
   * @param {object} post Selected recent post.
   * @returns {void}
   */
  function removePost(post) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setError('');
    setFeedback('');
    try {
      deletePost(session, post.id);
      setPosts(listPosts());
      setFeedback('Post deleted.');
    } catch (failure) { setError(failure.message); }
  }

  if (!isValidSession(session)) return <Navigate to="/login" replace />;
  if (session.role !== 'admin') return <Navigate to="/blogs" replace />;
  const registered = accounts.filter((account) => account.id !== 'admin').length;
  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <header className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">Local administration</p>
        <h1 className={`${displayFont} mt-3 text-4xl`}>Admin Dashboard</h1>
        <p className="mt-4">Your publication and accounts, in this browser.</p>
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-600">{error}</p>}
      {feedback && <p role="status" className="text-teal-700">{feedback}</p>}
      <section aria-label="Publication statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" count={posts.length} accent="indigo" />
        <StatCard label="Total Users" count={accounts.length} accent="violet" />
        <StatCard label="Total Admins" count={accounts.filter((account) => account.role === 'admin').length} accent="pink" />
        <StatCard label="Total users (repeated)" count={registered} accent="teal" />
      </section>
      <p className="text-sm text-slate-500">
        Total Users includes the built-in account. The fourth card repeats the registered-users count; the requested duplication is retained explicitly.
      </p>
      <nav aria-label="Quick actions" className="flex flex-col gap-3 sm:flex-row">
        <Link to="/write" className={buttonStyles.primary}>Write New Post</Link>
        <Link to="/users" className={buttonStyles.secondary}>Manage Users</Link>
      </nav>
      <section aria-labelledby="recent-posts-heading" className="space-y-4">
        <h2 id="recent-posts-heading" className={`${displayFont} text-2xl text-slate-900`}>Recent posts</h2>
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
            No posts yet. Write your first post to get started.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.slice(0, 5).map((post) => (
              <li
                key={post.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    to={`/blog/${encodeURIComponent(post.id)}`}
                    className="break-words font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4"
                  >
                    {post.title}
                  </Link>
                  <p className="mt-2 text-sm text-slate-500">{post.authorName} · {formatPostDate(post.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    to={`/edit/${encodeURIComponent(post.id)}`}
                    aria-label={`Edit ${post.title}`}
                    className={buttonStyles.secondary}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${post.title}`}
                    onClick={() => removePost(post)}
                    className={buttonStyles.destructive}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

AdminDashboard.propTypes = { session: PropTypes.object };
