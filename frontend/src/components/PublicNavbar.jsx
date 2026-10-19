/** Provide guest entry points without introducing identity logic in discovery. */
import { Link } from 'react-router-dom';
import { buttonStyles, displayFont, focusRing } from '../utils/styles';

/** Render sticky public navigation that fits narrow mobile viewports.
 * @returns {JSX.Element} Brand and login/registration links.
 */
export function PublicNavbar() {
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
          <Link to="/login" className={buttonStyles.ghost}>
            Login
          </Link>
          <Link to="/register" className={buttonStyles.primary}>
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
