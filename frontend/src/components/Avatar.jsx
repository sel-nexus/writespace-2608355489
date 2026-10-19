/** Render the product's static role identity, without uploads or external images. */
import PropTypes from 'prop-types';

const avatars = {
  admin: { emoji: '👑', label: 'Admin avatar', color: 'bg-violet-600' },
  user: { emoji: '📖', label: 'User avatar', color: 'bg-indigo-500' },
};
const unknownAvatar = { emoji: '?', label: 'Unknown role avatar', color: 'bg-slate-500' };

/** Render a named avatar, keeping unsupported roles visibly neutral.
 * @param {string} role Internal role name.
 * @returns {JSX.Element} Accessible role chip.
 */
export function getAvatar(role) {
  const avatar = Object.hasOwn(avatars, role) ? avatars[role] : unknownAvatar;
  return (
    <span
      role="img"
      aria-label={avatar.label}
      className={`${avatar.color} inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-white`}
    >
      <span aria-hidden="true">{avatar.emoji}</span>
    </span>
  );
}

/** Provide a component interface for role avatar consumers.
 * @param {object} props Role to display.
 * @returns {JSX.Element} Static role chip.
 */
export function Avatar({ role }) {
  return getAvatar(role);
}

Avatar.propTypes = { role: PropTypes.string };
