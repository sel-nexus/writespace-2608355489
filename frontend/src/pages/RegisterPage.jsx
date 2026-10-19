/** Create local writer accounts with plaintext demo passwords, not secure identity. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { getRoleHome, register } from '../utils/auth';
import { buttonStyles, displayFont, focusRing } from '../utils/styles';

/** Render self-registration with no role input and honest persistence failures.
 * @param {object} props Session refresh callback.
 * @returns {JSX.Element} Four-field registration form.
 */
export default function RegisterPage({ onSessionChange }) {
  const [fields, setFields] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Update a field and remove feedback made stale by editing.
   * @param {React.ChangeEvent<HTMLInputElement>} event Native input change.
   * @returns {void}
   */
  function changeField(event) {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '', ...(name === 'password' ? { confirmPassword: '' } : {}) }));
    setError('');
  }

  /** Validate fields, then refresh and navigate only after both writes succeed.
   * @param {React.FormEvent<HTMLFormElement>} event Native submission.
   * @returns {void}
   */
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!fields.displayName.trim()) nextErrors.displayName = 'Display Name is required.';
    if (!fields.username.trim()) nextErrors.username = 'Username is required.';
    if (!fields.password.trim()) nextErrors.password = 'Password is required.';
    if (!fields.confirmPassword.trim()) nextErrors.confirmPassword = 'Confirm Password is required.';
    if (fields.password.trim() && fields.confirmPassword.trim() && fields.password !== fields.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords must match.';
    }
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length) return;

    try {
      const session = register(fields);
      onSessionChange();
      navigate(getRoleHome(session), { replace: true });
    } catch (failure) {
      if (failure.message === 'Username is already taken.') {
        setErrors({ username: failure.message });
      } else {
        // Account and session writes are separate; do not claim rollback or success.
        const recovery = failure.message.startsWith('Could not save session')
          ? ' Your account may already be saved. Restore storage access and use Login with the same credentials.'
          : '';
        setError(`${failure.message}${recovery}`);
      }
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-20">
      <section aria-labelledby="register-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link to="/" className={`${displayFont} ${focusRing} rounded text-xl font-bold text-indigo-700`}>
          WriteSpace.
        </Link>
        <h1 id="register-heading" className={`${displayFont} mt-6 text-4xl text-slate-900`}>
          Create your account
        </h1>
        <p className="mt-3 text-slate-600">A local space for your next story. All fields are required.</p>
        <form onSubmit={submit} noValidate aria-label="Register" className="mt-8 space-y-5">
          <FormField
            id="register-display-name"
            label="Display Name"
            name="displayName"
            type="text"
            autoComplete="nickname"
            required
            value={fields.displayName}
            onChange={changeField}
            error={errors.displayName}
          />
          <FormField
            id="register-username"
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
            id="register-password"
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={fields.password}
            onChange={changeField}
            error={errors.password}
          />
          <FormField
            id="register-confirm-password"
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={fields.confirmPassword}
            onChange={changeField}
            error={errors.confirmPassword}
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">{error}</p>
          )}
          <button type="submit" className={`${buttonStyles.primary} w-full`}>
            Register
          </button>
        </form>
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          Demo only: passwords are stored in plaintext in this browser. Use non-sensitive demo credentials, never a real password. Accounts stay in this browser only.
        </p>
        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className={`${focusRing} rounded font-medium text-indigo-700 underline underline-offset-4`}>
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}

RegisterPage.propTypes = {
  onSessionChange: PropTypes.func.isRequired,
};
