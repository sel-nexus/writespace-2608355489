/** Wire discovery only; subsequent slices add their own feature routes. */
import { Link, Route, Routes } from 'react-router-dom';
import { PublicNavbar } from './components/PublicNavbar';
import LandingPage from './pages/LandingPage';
import { buttonStyles, displayFont } from './utils/styles';

/** Render the public shell and a truthful not-found state for unwired routes.
 * @returns {JSX.Element} Landing route and recoverable unmatched-route content.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <a
        href="#main-content"
        className="sr-only rounded bg-white p-3 text-indigo-700 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <PublicNavbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="*"
          element={
            <main id="main-content" className="mx-auto max-w-6xl px-6 py-24">
              <h1 className={`${displayFont} text-4xl text-slate-900`}>Page not found</h1>
              <p className="my-6 text-slate-600">This destination is not available in the discovery slice.</p>
              <Link to="/" className={buttonStyles.primary}>Back to Home</Link>
            </main>
          }
        />
      </Routes>
    </div>
  );
}
