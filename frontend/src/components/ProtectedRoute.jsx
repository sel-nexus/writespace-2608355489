/** Apply demo-only client route access rules; these are not server security. */
import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';
import { isValidSession } from '../utils/auth';

/** Reject guests first, then redirect ordinary writers away from administrator routes.
 * @param {object} props Current session, optional admin requirement and route content.
 * @returns {JSX.Element} Content, nested outlet or replace redirect.
 */
export function ProtectedRoute({ session = null, adminOnly = false, children }) {
  if (!isValidSession(session)) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children ?? <Outlet />;
}

ProtectedRoute.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
  adminOnly: PropTypes.bool,
  children: PropTypes.node,
};
