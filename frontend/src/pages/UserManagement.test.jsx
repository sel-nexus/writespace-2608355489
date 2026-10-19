/** Verify real admin account form, responsive structures, feedback, and deletion denials. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import UserManagement from './UserManagement';
import { getUsers, saveUsers } from '../utils/storage';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const account = { id: 'local', displayName: 'Local', username: 'local', password: 'dummy', role: 'admin', createdAt: '2025-01-02T00:00:00.000Z' };

/** Render management and real redirect/link destinations.
 * @param {object|null} session Candidate identity.
 * @returns {object} Interaction driver and render handle.
 */
function setup(session = admin) {
  const view = render(
    <MemoryRouter initialEntries={['/users']}>
      <Routes>
        <Route
          path="/users"
          element={<UserManagement session={session} />}
        />
        <Route
          path="/admin"
          element={<h1>Dashboard destination</h1>}
        />
        <Route
          path="/blogs"
          element={<h1>Blogs destination</h1>}
        />
        <Route
          path="/login"
          element={<h1>Login destination</h1>}
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, user: userEvent.setup() };
}

/** Fill native account fields using accessible names.
 * @param {object} user Interaction driver.
 * @param {string} role Supported account role.
 * @param {string} username Unique account username.
 * @returns {Promise<void>} Completed input interactions.
 */
async function fill(user, role = 'user', username = 'new-account') {
  await user.type(screen.getByLabelText('Display Name *'), 'New Account');
  await user.type(screen.getByLabelText('Username *'), username);
  await user.type(screen.getByLabelText('Password *'), 'dummy-only');
  await user.selectOptions(screen.getByLabelText('Role *'), role);
}

/** Select the desktop action while jsdom lacks CSS media-query visibility.
 * @param {string} username Account username.
 * @returns {HTMLElement} Delete control within its semantic table row.
 */
function deleteButton(username = 'local') {
  return within(screen.getByRole('row', { name: `Account ${username}` })).getByRole('button', { name: `Delete ${username}` });
}

describe('UserManagement', () => {
  it('uses responsive native table/mobile cards, truthful builtin date and plaintext warning', () => {
    saveUsers([account]);
    setup();
    expect(screen.getByLabelText('Desktop accounts')).toHaveClass('hidden', 'sm:block', 'overflow-x-auto');
    expect(screen.getByLabelText('Mobile accounts')).toHaveClass('sm:hidden');
    expect(screen.getByRole('table', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    screen.getAllByRole('columnheader').forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    expect(within(screen.getByLabelText('Mobile accounts')).getAllByRole('article')).toHaveLength(2);
    expect(screen.getAllByText('Built-in')).toHaveLength(2);
    expect(screen.getByText(/Passwords are stored in plaintext/)).toHaveTextContent('never a real password');
    expect(deleteButton('admin')).toBeDisabled();
    expect(deleteButton('admin')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  });
  it('shows no registered accounts while retaining builtin and navigates to dashboard', async () => {
    const { user } = setup();
    expect(screen.getByText(/No registered accounts yet/)).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Back to Dashboard' }));
    expect(screen.getByRole('heading', { name: 'Dashboard destination' })).toBeVisible();
  });
  it.each(['user', 'admin'])('creates %s account, requeries actual accounts and clears draft with success', async (role) => {
    const { user } = setup();
    await fill(user, role);
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    const [created] = getUsers();
    expect(created).toMatchObject({ displayName: 'New Account', username: 'new-account', password: 'dummy-only', role });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Number.isFinite(Date.parse(created.createdAt))).toBe(true);
    expect(screen.getByRole('row', { name: 'Account new-account' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Account new-account' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Account new-account created.');
    expect(screen.getByLabelText('Username *')).toHaveValue('');
    expect(screen.getByLabelText('Role *')).toHaveValue('');
  });
  it('exposes four associated required errors and allows correction', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    for (const label of ['Display Name *', 'Username *', 'Password *', 'Role *']) {
      expect(screen.getByLabelText(label)).toBeRequired();
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-describedby');
    }
    expect(getUsers()).toEqual([]);
    await fill(user);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(getUsers()).toHaveLength(1);
  });
  it.each(['ADMIN', 'LOCAL'])('reports unique/reserved username %s without clearing draft or changing accounts', async (username) => {
    saveUsers([account]);
    const { user } = setup();
    await fill(user, 'admin', username);
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Username is already taken.');
    expect(screen.getByLabelText('Username *')).toHaveValue(username);
    expect(getUsers()).toEqual([account]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('cancels draft without mutation and clears field errors', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    await fill(user);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(writes).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Display Name *')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('cancel confirmation never writes; acceptance deletes and requeries accounts', async () => {
    saveUsers([account]);
    const { user } = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(deleteButton());
    expect(confirm).toHaveBeenCalledWith('Delete account "local"? This cannot be undone.');
    expect(writes).not.toHaveBeenCalled();
    expect(getUsers()).toEqual([account]);
    confirm.mockReturnValue(true);
    await user.click(deleteButton());
    expect(getUsers()).toEqual([]);
    expect(screen.queryByRole('row', { name: 'Account local' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Account local deleted.');
  });
  it('disables builtin/current administrator, never confirming or writing', async () => {
    saveUsers([account]);
    const { user } = setup({ ...admin, userId: 'local', username: 'local' });
    const confirm = vi.spyOn(window, 'confirm');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    for (const username of ['admin', 'local']) {
      expect(deleteButton(username)).toBeDisabled();
      await user.click(deleteButton(username));
    }
    expect(deleteButton()).toHaveAttribute('title', 'You cannot delete your current account.');
    expect(confirm).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });
  it.each(['quota', 'UUID', 'corrupt', 'blocked', 'discarded'])('reports create %s failure, preserves draft and avoids success', async (failure) => {
    const { user } = setup();
    await fill(user);
    if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    if (failure === 'UUID') vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => { throw new Error('Missing'); });
    if (failure === 'corrupt') localStorage.setItem('writespace_users', '{broken');
    if (failure === 'blocked') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    if (failure === 'discarded') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByLabelText('Username *')).toHaveValue('new-account');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    if (failure !== 'blocked' && failure !== 'corrupt') expect(getUsers()).toEqual([]);
  });
  it.each(['quota', 'missing', 'corrupt', 'discarded'])('reports deletion %s denial without false success', async (failure) => {
    saveUsers([account]);
    const { user } = setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    if (failure === 'missing') saveUsers([]);
    if (failure === 'corrupt') localStorage.setItem('writespace_users', '{broken');
    if (failure === 'discarded') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    await user.click(deleteButton());
    expect(screen.getByRole('alert')).toHaveTextContent(failure === 'missing' ? 'Account not found.' : failure === 'quota' ? 'Could not save accounts' : failure === 'corrupt' ? 'Could not read accounts safely' : 'Could not verify saved accounts.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    if (failure === 'quota' || failure === 'discarded') expect(getUsers()).toEqual([account]);
  });
  it.each(['corrupt', 'blocked'])('shows explicit initial read error %s with no fake accounts', (failure) => {
    if (failure === 'corrupt') localStorage.setItem('writespace_users', '[{}]');
    else vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not read accounts safely');
    expect(screen.queryByRole('row', { name: 'Account admin' })).not.toBeInTheDocument();
  });
  it.each([null, {}, { ...admin, role: 'user' }])('denies candidate identity %j before management UI', (session) => {
    setup(session);
    expect(screen.getByRole('heading', { name: session?.role === 'user' ? 'Blogs destination' : 'Login destination' })).toBeVisible();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});
