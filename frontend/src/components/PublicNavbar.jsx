/** Provide public entry points and role-home navigation without replacing discovery. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { getRoleHome } from '../utils/auth';
import { buttonStyles, displayFont, focusRing } from '../utils/styles';

/** Render sticky public navigation that fits narrow mobile viewports.
 * @param {object} props Optional active session.
 * @returns {JSX.Element} Brand and guest entry points or identity and dashboard link.
 */
export function PublicNavbar({ session = null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          to="/"
          aria-label="WriteSpace."
          className={`${displayFont} ${focusRing} rounded text-xl font-bold text-slate-900 sm:text-2xl`}
        >
          WriteSpace
          <span aria-hidden="true" className="text-indigo-600">.</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          {session ? (
            <>
              <Avatar role={session.role} />
              <span className="max-w-32 truncate text-sm font-medium">{session.displayName}</span>
              <Link to={getRoleHome(session)} className={buttonStyles.primary}>
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className={buttonStyles.ghost}>
                Login
              </Link>
              <Link to="/register" className={buttonStyles.primary}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
