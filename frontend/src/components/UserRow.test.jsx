/** Verify account semantics, truthful dates, roles, and protected actions in both layouts. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserRow } from './UserRow';

const account = { id: 'writer', displayName: 'Writer', username: 'writer', role: 'user', createdAt: '2025-01-02T00:00:00.000Z' };

/** Mount the row within valid native table structure or a mobile wrapper.
 * @param {object} options Layout and account overrides.
 * @returns {object} Callback and interaction driver.
 */
function setup({ mobile = false, record = account, currentUserId = 'admin' } = {}) {
  const onDelete = vi.fn();
  const row = <UserRow account={record} currentUserId={currentUserId} onDelete={onDelete} mobile={mobile} />;
  render(mobile ? <div>{row}</div> : <table><tbody>{row}</tbody></table>);
  return { onDelete, user: userEvent.setup() };
}

describe('UserRow', () => {
  it.each([false, true])('renders semantic layout mobile=%s and calls eligible deletion', async (mobile) => {
    const { user, onDelete } = setup({ mobile });
    expect(screen.getByRole(mobile ? 'article' : 'row', { name: 'Account writer' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'User avatar' })).toBeVisible();
    expect(screen.getByText('Jan 02, 2025')).toBeVisible();
    expect(screen.getByText('user')).toHaveClass('bg-indigo-100');
    if (mobile) expect(screen.getByText('Username').tagName).toBe('DT');
    else expect(screen.getByRole('rowheader')).toHaveAttribute('scope', 'row');
    await user.click(screen.getByRole('button', { name: 'Delete writer' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(account);
  });
  it.each([false, true])('truthfully displays protected builtin in mobile=%s', async (mobile) => {
    const { user, onDelete } = setup({ mobile, record: { ...account, id: 'admin', username: 'admin', displayName: 'Admin', role: 'admin', createdAt: null } });
    const button = screen.getByRole('button', { name: 'Delete admin' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Default admin cannot be deleted.');
    expect(screen.getByText('Built-in')).toBeVisible();
    expect(screen.queryByText('Jan 02, 2025')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeVisible();
    expect(screen.getByText('Admin', { selector: 'span.rounded-full' })).toHaveClass('bg-violet-100');
    await user.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });
  it.each([false, true])('disables current registered administrator mobile=%s', async (mobile) => {
    const { user, onDelete } = setup({ mobile, currentUserId: 'writer', record: { ...account, role: 'admin' } });
    const button = screen.getByRole('button', { name: 'Delete writer' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'You cannot delete your current account.');
    await user.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
