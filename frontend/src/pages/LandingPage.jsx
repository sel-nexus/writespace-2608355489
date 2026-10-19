/** Introduce browser-local writing and preview only real persisted posts. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { isValidSession } from '../utils/auth';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard';
import { getPosts } from '../utils/storage';
import { buttonStyles, displayFont, focusRing } from '../utils/styles';

/** Render public discovery with newest-first local previews and guest CTAs.
 * @returns {JSX.Element} Hero, features, latest posts, and public footer.
 * Notes: No posts are seeded; unavailable storage produces the same safe empty state.
 */
export default function LandingPage({ session = null }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    setPosts(getPosts().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3));
  }, []);

  return (
    <>
      <main id="main-content">
        <section aria-labelledby="hero-title" className="bg-slate-50">
          <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                A little room for your ideas
              </p>
              <h1
                id="hero-title"
                className={`${displayFont} mt-6 text-[clamp(3rem,7vw,5.5rem)] leading-[1.06] tracking-tight text-slate-900`}
              >
                Your thoughts.
                <br />
                Your space.
                <br />
                <span className="text-indigo-600">Beautifully simple.</span>
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-8 text-slate-600">
                WriteSpace gives your words somewhere to land. Write plain-text posts,
                revisit your ideas, and read what’s been saved in this browser.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link to="/register" className={buttonStyles.primary}>
                  Get Started Free
                </Link>
                <Link to={isValidSession(session) ? '/blogs' : '/login'} className={buttonStyles.secondary}>
                  Start Reading
                </Link>
              </div>
              <p className="mt-5 text-sm text-slate-500">
                Browser-local demo. No syncing, no server. Non-sensitive data only.
              </p>
            </div>
            <aside aria-label="Writing preview" className="lg:col-span-5 lg:pl-6">
              <div className="rounded-2xl bg-indigo-100 p-5 sm:p-8">
                <div className="mb-5 flex items-center justify-between gap-3 border-b border-indigo-200 pb-4">
                  <p className={`${displayFont} text-lg text-indigo-950`}>
                    Inside WriteSpace
                  </p>
                  <span className="text-xs text-indigo-700">Your browser’s bookshelf</span>
                </div>
                {posts.length > 0 ? (
                  <div
                    className="motion-safe:animate-[bounce_6s_ease-in-out_1] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
                  >
                    <BlogCard post={posts[0]} />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white p-7 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-widest text-indigo-700">
                      A blank page is a beginning
                    </p>
                    <p className={`${displayFont} mt-4 text-3xl leading-tight text-slate-900`}>
                      Your first story belongs here.
                    </p>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      When a post is saved, its real preview will appear here. Nothing is filled in for you.
                    </p>
                  </div>
                )}
                <p className="mt-5 text-xs leading-5 text-indigo-900">
                  Plain text. A title, a date, a voice. Just the essentials.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
            Less between you and the page
          </p>
          <h2 id="features-title" className={`${displayFont} mt-4 text-4xl text-slate-900`}>
            Space to think. Freedom to write.
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-5">
            <article className="rounded-2xl bg-slate-900 p-8 text-white md:col-span-3 md:row-span-2 md:p-10">
              <p className="text-sm text-indigo-200">01 / The writing</p>
              <h3 className={`${displayFont} mt-10 text-4xl`}>Write Freely</h3>
              <p className="mt-5 max-w-md leading-8 text-slate-300">
                Start with a title. Follow it with your thoughts. Plain-text writing keeps
                the attention on what you have to say—not on a formatting toolbar.
              </p>
              <p className={`${displayFont} mt-12 border-t border-slate-700 pt-7 text-2xl italic text-slate-200`}>
                An idea doesn’t need a perfect first draft.
              </p>
            </article>
            <article className="rounded-2xl bg-slate-50 p-7 md:col-span-2">
              <p className="text-sm text-indigo-700">02 / The place</p>
              <h3 className={`${displayFont} mt-4 text-2xl text-slate-900`}>Private &amp; Local</h3>
              <p className="mt-3 leading-7 text-slate-600">
                Data stays in this browser’s local storage. It is not encrypted or synced;
                use only demo posts and dummy passwords.
              </p>
            </article>
            <article className="rounded-2xl bg-indigo-50 p-7 md:col-span-2">
              <p className="text-sm text-indigo-700">03 / The pace</p>
              <h3 className={`${displayFont} mt-4 text-2xl text-slate-900`}>Instant &amp; Fast</h3>
              <p className="mt-3 leading-7 text-slate-600">
                No server to wait for. Your browser handles the reading and writing,
                so you can keep moving with your ideas.
              </p>
            </article>
          </div>
        </section>

        <section aria-labelledby="latest-title" className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">The local edition</p>
                <h2 id="latest-title" className={`${displayFont} mt-4 text-4xl text-slate-900`}>
                  Latest from the Blog
                </h2>
              </div>
              <Link to="/blogs" className={buttonStyles.secondary}>
                All Blogs
              </Link>
            </div>
            {posts.length > 0 ? (
              <div className="mt-9 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post, index) => (
                  <BlogCard key={post.id} post={post} index={index} />
                ))}
              </div>
            ) : (
              <div className="mt-9 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <p className={`${displayFont} text-2xl text-slate-800`}>
                  No posts yet — check back soon!
                </p>
                <p className="mt-3 text-sm text-slate-600">The next page starts with you.</p>
                <Link to="/register" className={`${buttonStyles.primary} mt-6`}>
                  Start your story
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="bg-slate-900 text-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-6 py-10">
          <div>
            <p className={`${displayFont} text-2xl text-white`}>WriteSpace.</p>
            <p className="mt-3 text-sm text-slate-300">© {new Date().getFullYear()} WriteSpace</p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-6 text-sm">
            <Link to="/" className={`${focusRing} rounded hover:text-white`}>Home</Link>
            <Link to="/blogs" className={`${focusRing} rounded hover:text-white`}>All Blogs</Link>
            <Link to="/login" className={`${focusRing} rounded hover:text-white`}>Login</Link>
            <Link to="/register" className={`${focusRing} rounded hover:text-white`}>Register</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

LandingPage.propTypes = { session: PropTypes.object };
