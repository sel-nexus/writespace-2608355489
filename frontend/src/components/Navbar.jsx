/** Keep role navigation mounted across protected pages and report failed logout honestly. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { clearSession } from '../utils/auth';
import { buttonStyles, displayFont, focusRing } from '../utils/styles';

/** Render responsive links and an accessible profile disclosure.
 * @param {object} props Current identity and callback to reread the session after logout.
 * @returns {JSX.Element} Sticky protected navigation and optional storage alert.
 */
export function Navbar({ session, onSessionChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const links = [['All Blogs', '/blogs'], ['Write', '/write']];
  if (session.role === 'admin') links.push(['Users', '/users']);

  /** Clear storage before refreshing UI or navigating; retain identity on failure.
   * @returns {void}
   */
  function logout() {
    setError('');
    try {
      clearSession();
      onSessionChange();
      setProfileOpen(false);
      setMenuOpen(false);
      navigate('/');
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
      <nav aria-label="Authenticated navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="WriteSpace." className={`${displayFont} ${focusRing} mr-auto rounded text-xl font-bold text-slate-900 sm:text-2xl`}>
          WriteSpace
          <span aria-hidden="true" className="text-indigo-600">.</span>
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          aria-controls="role-navigation-links"
          onClick={() => setMenuOpen(!menuOpen)}
          className={`${buttonStyles.ghost} sm:hidden`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-6 w-6">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div id="role-navigation-links" className={`${menuOpen ? 'flex' : 'hidden'} order-last w-full flex-col gap-2 sm:order-none sm:flex sm:w-auto sm:flex-row`}>
          {links.map(([label, destination]) => (
            <NavLink
              key={destination}
              to={destination}
              onClick={() => { setMenuOpen(false); setProfileOpen(false); }}
              className={({ isActive }) => `${focusRing} inline-flex min-h-11 items-center rounded-full px-4 py-2 font-medium motion-safe:transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </NavLink>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label={`Profile for ${session.displayName}`}
            aria-expanded={profileOpen}
            aria-controls="profile-actions"
            onClick={() => setProfileOpen(!profileOpen)}
            onKeyDown={(event) => { if (event.key === 'Escape') setProfileOpen(false); }}
            className={`${focusRing} flex min-h-11 max-w-48 items-center gap-2 rounded-full px-2 text-sm font-medium`}
          >
            <Avatar role={session.role} />
            <span className="truncate">{session.displayName}</span>
          </button>
          {profileOpen && (
            <div id="profile-actions" onKeyDown={(event) => { if (event.key === 'Escape') setProfileOpen(false); }} className="absolute right-0 top-full mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
              <button type="button" onClick={logout} className={buttonStyles.destructive}>
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
      {error && (
        <p role="alert" className="mx-auto max-w-6xl px-4 pb-3 text-sm text-red-600">{error}</p>
      )}
    </header>
  );
}

Navbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }).isRequired,
  onSessionChange: PropTypes.func.isRequired,
};
