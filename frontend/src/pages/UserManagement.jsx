/** Create and remove browser-local demo accounts through administrator-only services. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { UserRow } from '../components/UserRow';
import { isValidSession } from '../utils/auth';
import { createUser, deleteUser, listAccounts, validateUser } from '../utils/users';
import { buttonStyles, displayFont, fieldStyle } from '../utils/styles';

const emptyFields = { displayName: '', username: '', password: '', role: '' };

/** Keep form drafts separate from real persisted accounts and protected deletions.
 * @param {object} props Current administrator identity.
 * @returns {JSX.Element} Responsive account management or role redirect.
 */
export default function UserManagement({ session = null }) {
  const [accounts, setAccounts] = useState([]);
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (!isValidSession(session) || session.role !== 'admin') return;
    try { setAccounts(listAccounts(session)); }
    catch (failure) { setError(failure.message); }
  }, [session]);

  /** Update a draft field and clear only its stale validation feedback.
   * @param {string} field Field identity.
   * @param {string} value Native control value.
   * @returns {void}
   */
  function changeField(field, value) {
    setFields((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: '' }));
    setError('');
    setFeedback('');
  }

  /** Validate and create an account, reporting success only after storage requery.
   * @param {Event} event Native submit event.
   * @returns {void}
   */
  function submit(event) {
    event.preventDefault();
    const validation = validateUser(fields);
    setErrors(validation);
    setError('');
    setFeedback('');
    if (Object.keys(validation).length) return;
    try {
      const account = createUser(session, fields);
      setAccounts(listAccounts(session));
      setFields(emptyFields);
      setFeedback(`Account ${account.username} created.`);
    } catch (failure) { setError(failure.message); }
  }

  /** Confirm eligible removal before mutation, retaining the list on failure.
   * @param {object} account Selected persisted account.
   * @returns {void}
   */
  function removeAccount(account) {
    if (!window.confirm(`Delete account "${account.username}"? This cannot be undone.`)) return;
    setError('');
    setFeedback('');
    try {
      deleteUser(session, account.id);
      setAccounts(listAccounts(session));
      setFeedback(`Account ${account.username} deleted.`);
    } catch (failure) { setError(failure.message); }
  }

  if (!isValidSession(session)) return <Navigate to="/login" replace />;
  if (session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <header>
        <Link to="/admin" className={buttonStyles.ghost}>Back to Dashboard</Link>
        <h1 className={`${displayFont} mt-4 text-4xl text-slate-900`}>User Management</h1>
        <p className="mt-4 text-slate-600">Manage the people who can publish in this browser.</p>
      </header>
      <section aria-labelledby="create-user-heading" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 id="create-user-heading" className={`${displayFont} text-2xl`}>Create User</h2>
        <p className="mt-3 text-sm text-slate-600">Passwords are stored in plaintext. Use non-sensitive demo credentials, never a real password.</p>
        <form aria-label="Create User" onSubmit={submit} noValidate className="mt-6 grid gap-5 md:grid-cols-2">
          <FormField
            id="displayName"
            label="Display Name"
            required
            value={fields.displayName}
            error={errors.displayName}
            onChange={(event) => changeField('displayName', event.target.value)}
          />
          <FormField
            id="username"
            label="Username"
            required
            autoComplete="off"
            value={fields.username}
            error={errors.username}
            onChange={(event) => changeField('username', event.target.value)}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={fields.password}
            error={errors.password}
            onChange={(event) => changeField('password', event.target.value)}
          />
          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-medium">Role *</label>
            <select
              id="role"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'role-error' : undefined}
              value={fields.role}
              onChange={(event) => changeField('role', event.target.value)}
              className={fieldStyle}
            >
              <option value="">Choose a role</option>
              <option value="admin">Admin</option>
              <option value="user">user</option>
            </select>
            {errors.role && <p id="role-error" role="alert" className="text-sm text-red-600">{errors.role}</p>}
          </div>
          <div className="flex flex-col gap-3 md:col-span-2 md:flex-row">
            <button type="submit" className={buttonStyles.primary}>Create User</button>
            <button
              type="button"
              onClick={() => { setFields(emptyFields); setErrors({}); setError(''); setFeedback(''); }}
              className={buttonStyles.ghost}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-600">{error}</p>}
      {feedback && <p role="status" className="text-teal-700">{feedback}</p>}
      <section aria-labelledby="accounts-heading" className="space-y-4">
        <h2 id="accounts-heading" className={`${displayFont} text-2xl`}>Accounts</h2>
        {accounts.length === 1 && <p className="text-slate-500">No registered accounts yet. The built-in admin is always available.</p>}
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block" aria-label="Desktop accounts">
          <table aria-label="Accounts" className="w-full text-left">
            <thead className="bg-slate-100 text-sm text-slate-600">
              <tr>
                {['Display Name', 'Username', 'Role', 'Created', 'Actions'].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <UserRow
                  key={account.id}
                  account={account}
                  currentUserId={session.userId}
                  onDelete={removeAccount}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div aria-label="Mobile accounts" className="space-y-3 sm:hidden">
          {accounts.map((account) => (
            <UserRow
              key={account.id}
              account={account}
              currentUserId={session.userId}
              onDelete={removeAccount}
              mobile
            />
          ))}
        </div>
      </section>
    </main>
  );
}

UserManagement.propTypes = { session: PropTypes.object };
