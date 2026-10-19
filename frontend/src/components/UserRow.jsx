/** Present account identity as a semantic table row or mobile card. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar';
import { formatPostDate } from '../utils/posts';
import { buttonStyles } from '../utils/styles';

const badges = {
  admin: 'bg-violet-100 text-violet-700 ring-violet-300',
  user: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
};

/** Render protected actions consistently in desktop and mobile layouts.
 * @param {object} props Account, current identity, deletion callback, and mobile mode.
 * @returns {JSX.Element} Table row or stacked account article.
 */
export function UserRow({ account, currentUserId, onDelete, mobile = false }) {
  const reason = account.id === 'admin' ? 'Default admin cannot be deleted.'
    : account.id === currentUserId ? 'You cannot delete your current account.' : '';
  const date = account.id === 'admin' ? 'Built-in' : formatPostDate(account.createdAt);
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={account.role} />
      <span className="break-words font-medium text-slate-900">{account.displayName}</span>
    </div>
  );
  const badge = (
    <span className={`${badges[account.role]} rounded-full px-3 py-0.5 text-sm font-medium ring-1`}>
      {account.role === 'admin' ? 'Admin' : 'user'}
    </span>
  );
  const action = (
    <span title={reason || undefined} className="inline-flex">
      <button
        type="button" disabled={Boolean(reason)} title={reason || undefined}
        aria-label={`Delete ${account.username}`} onClick={() => { if (!reason) onDelete(account); }}
        className={`${buttonStyles.destructive} disabled:cursor-not-allowed disabled:opacity-60`}
      >Delete</button>
    </span>
  );
  if (mobile) {
    return (
      <article aria-label={`Account ${account.username}`} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        {identity}
        <dl className="space-y-3 text-sm">
          <div><dt className="text-slate-500">Username</dt><dd className="break-all">{account.username}</dd></div>
          <div><dt className="mb-1 text-slate-500">Role</dt><dd>{badge}</dd></div>
          <div><dt className="text-slate-500">Created</dt><dd>{date}</dd></div>
        </dl>
        {action}
      </article>
    );
  }
  return (
    <tr aria-label={`Account ${account.username}`} className="border-b border-slate-100">
      <th scope="row" className="px-4 py-4 text-left">{identity}</th>
      <td className="break-all px-4 py-4">{account.username}</td>
      <td className="px-4 py-4">{badge}</td>
      <td className="px-4 py-4 text-sm text-slate-500">{date}</td>
      <td className="px-4 py-4">{action}</td>
    </tr>
  );
}

UserRow.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  currentUserId: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
