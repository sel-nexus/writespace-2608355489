/** Sign in with browser-local demo credentials, never real or sensitive passwords. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { getRoleHome, login } from '../utils/auth';
import { buttonStyles, displayFont, focusRing } from '../utils/styles';

/** Render accessible login and refresh the parent only after persistence succeeds.
 * @param {object} props Session refresh callback.
 * @returns {JSX.Element} Demo login form with field and storage errors.
 */
export default function LoginPage({ onSessionChange }) {
  const [fields, setFields] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Keep entered values and clear stale feedback for the changed field.
   * @param {React.ChangeEvent<HTMLInputElement>} event Native input change.
   * @returns {void}
   */
  function changeField(event) {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  }

  /** Validate required fields before asking the helper to persist a session.
   * @param {React.FormEvent<HTMLFormElement>} event Native submission.
   * @returns {void}
   */
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!fields.username.trim()) nextErrors.username = 'Username is required.';
    if (!fields.password.trim()) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length) return;

    try {
      const session = login(fields.username, fields.password);
      onSessionChange();
      navigate(getRoleHome(session), { replace: true });
    } catch (failure) {
      if (failure.message === 'Invalid username or password.') {
        setErrors({ password: failure.message });
      } else {
        setError(failure.message);
      }
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-20">
      <section aria-labelledby="login-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link to="/" className={`${displayFont} ${focusRing} rounded text-xl font-bold text-indigo-700`}>
          WriteSpace.
        </Link>
        <h1 id="login-heading" className={`${displayFont} mt-6 text-4xl text-slate-900`}>
          Welcome back
        </h1>
        <p className="mt-3 text-slate-600">Login to your local writing space.</p>
        <form onSubmit={submit} noValidate aria-label="Login" className="mt-8 space-y-5">
          <FormField
            id="login-username"
            label="Username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={fields.username}
            onChange={changeField}
            error={errors.username}
          />
          <FormField
            id="login-password"
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={fields.password}
            onChange={changeField}
            error={errors.password}
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">{error}</p>
          )}
          <button type="submit" className={`${buttonStyles.primary} w-full`}>
            Login
          </button>
        </form>
        <aside aria-label="Demo credentials" className="mt-6 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          <p>Demo only: passwords are stored in plaintext in this browser. Use non-sensitive demo credentials, never a real password.</p>
          <p className="mt-2 font-medium text-slate-800">Try the built-in administrator: admin / admin.</p>
        </aside>
        <p className="mt-6 text-sm text-slate-600">
          New to WriteSpace?{' '}
          <Link to="/register" className={`${focusRing} rounded font-medium text-indigo-700 underline underline-offset-4`}>
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}

LoginPage.propTypes = {
  onSessionChange: PropTypes.func.isRequired,
};
