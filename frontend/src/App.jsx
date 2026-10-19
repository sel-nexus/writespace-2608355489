/** Preserve discovery while wiring browser-local role access and persistent navigation. */
import { useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { getRoleHome, getSession } from './utils/auth';
import { PublicNavbar } from './components/PublicNavbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Home from './pages/Home';
import ReadBlog from './pages/ReadBlog';
import WriteBlog from './pages/WriteBlog';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import { buttonStyles, displayFont } from './utils/styles';

/** Render discovery, fail-closed guards and role navigation with local React state.
 * @returns {JSX.Element} Incremental routes with recoverable unfinished destinations.
 */
export default function App() {
  const [session, setCurrentSession] = useState(getSession);
  const { pathname } = useLocation();
  const publicPage = ['/', '/login', '/register'].includes(pathname);

  /** Reread storage after identity mutations rather than inventing a memory session.
   * @returns {void}
   */
  function refreshSession() {
    setCurrentSession(getSession());
  }

  const recoverableContent = (
    <main id="main-content" className="mx-auto max-w-6xl px-6 py-24">
      <h1 className={`${displayFont} text-4xl text-slate-900`}>Page not found</h1>
      <p className="my-6 text-slate-600">This destination is not available in the current slice.</p>
      <Link to="/" className={buttonStyles.primary}>Back to Home</Link>
    </main>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <a
        href="#main-content"
        className="sr-only rounded bg-white p-3 text-indigo-700 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      {publicPage || !session ? (
        <PublicNavbar session={session} />
      ) : (
        <Navbar session={session} onSessionChange={refreshSession} />
      )}
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route
          path="/login"
          element={session
            ? <Navigate to={getRoleHome(session)} replace />
            : <LoginPage onSessionChange={refreshSession} />}
        />
        <Route
          path="/register"
          element={session
            ? <Navigate to={getRoleHome(session)} replace />
            : <RegisterPage onSessionChange={refreshSession} />}
        />
        <Route element={<ProtectedRoute session={session} />}>
          <Route path="/blogs" element={<Home session={session} />} />
          <Route path="/blog/:id" element={<ReadBlog session={session} />} />
          <Route path="/write" element={<WriteBlog session={session} />} />
          <Route path="/edit/:id" element={<WriteBlog session={session} editing />} />
        </Route>
        <Route element={<ProtectedRoute session={session} adminOnly />}>
          <Route path="/admin" element={<AdminDashboard session={session} />} />
          <Route path="/users" element={<UserManagement session={session} />} />
        </Route>
        <Route path="*" element={recoverableContent} />
      </Routes>
    </div>
  );
}
