/** Present the authenticated newest-first local edition. */
import PropTypes from 'prop-types';
import { Link, Navigate } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard';
import { isValidSession } from '../utils/auth';
import { listPosts } from '../utils/posts';
import { buttonStyles, displayFont } from '../utils/styles';

/** Render real posts or a writing invitation.
 * @param {object} props Current session.
 * @returns {JSX.Element} Responsive feed or guest redirect.
 */
export default function Home({ session = null }) {
  if (!isValidSession(session)) return <Navigate to="/login" replace />;
  const posts = listPosts();
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-12 md:py-20">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">The local edition</p>
          <h1 className={`${displayFont} mt-4 text-4xl text-slate-900 md:text-5xl`}>All Blogs</h1>
          <p className="mt-4 text-slate-600">Ideas and stories saved in this browser, newest first.</p>
        </div>
        <Link to="/write" className={buttonStyles.primary}>Write New Post</Link>
      </header>
      {posts.length ? (
        <section aria-label="All posts" className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} session={session} />
          ))}
        </section>
      ) : (
        <section aria-label="Empty feed" className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16">
          <p className={`${displayFont} text-2xl text-slate-800`}>No blogs yet. Be the first to write one!</p>
          <Link to="/write" className={`${buttonStyles.secondary} mt-6`}>Write</Link>
        </section>
      )}
    </main>
  );
}

Home.propTypes = { session: PropTypes.object };
