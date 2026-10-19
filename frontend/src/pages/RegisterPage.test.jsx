/** Verify registration validation, real local persistence, and session-aware routing. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import RegisterPage from './RegisterPage';
import { getSession, setSession } from '../utils/auth';
import { getUsers, saveUsers } from '../utils/storage';

const fieldLabels = { displayName: 'Display Name', username: 'Username', password: 'Password', confirmPassword: 'Confirm Password' };
const demoFields = { displayName: 'Demo Writer', username: 'demo-writer', password: 'dummy-only', confirmPassword: 'dummy-only' };

/** Observe real navigation without mocking the router.
 * @returns {JSX.Element} Current route output.
 */
function Location() {
  const { pathname } = useLocation();
  return <output aria-label="Current route">{pathname}</output>;
}

/** Render the form with a callback that checks write-before-refresh-before-navigation.
 * @returns {object} Interaction driver and callback probe.
 */
function setupRegister() {
  const onSessionChange = vi.fn(() => {
    expect(getSession()).not.toBeNull();
    expect(getUsers()).toHaveLength(1);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Location />
      <Routes>
        <Route path="/register" element={<RegisterPage onSessionChange={onSessionChange} />} />
        <Route path="/blogs" element={<h1>Writer home</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return { user: userEvent.setup(), onSessionChange };
}

/** Fill each supplied field through its accessible label.
 * @param {object} user Interaction driver.
 * @param {object} fields Demo inputs; empty values remain untouched.
 * @returns {Promise<void>} Completion of native input interactions.
 */
async function fillRegister(user, fields = demoFields) {
  for (const [name, value] of Object.entries(fields)) {
    if (value) await user.type(screen.getByLabelText(`${fieldLabels[name]} *`, { exact: true }), value);
  }
}

describe('RegisterPage', () => {
  it('renders four required semantic fields, autocomplete and no role selector', () => {
    setupRegister();
    for (const label of Object.values(fieldLabels)) {
      const input = screen.getByLabelText(`${label} *`, { exact: true });
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    }
    expect(screen.getByLabelText('Display Name *')).toHaveAttribute('autocomplete', 'nickname');
    expect(screen.getByLabelText('Username *')).toHaveAttribute('autocomplete', 'username');
    for (const label of ['Password *', 'Confirm Password *']) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('autocomplete', 'new-password');
    }
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Role/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/passwords are stored in plaintext/)).toHaveTextContent('non-sensitive demo credentials, never a real password');
  });

  it.each(Object.keys(fieldLabels))('blocks missing %s and associates its inline error', async (missing) => {
    const { user, onSessionChange } = setupRegister();
    await fillRegister(user, { ...demoFields, [missing]: '' });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    const input = screen.getByLabelText(`${fieldLabels[missing]} *`, { exact: true });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(`${fieldLabels[missing]} is required.`);
    expect(screen.getByRole('alert').textContent).toBe(`${fieldLabels[missing]} is required.`);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });

  it('reports all empty or whitespace-only fields without saving', async () => {
    const { user } = setupRegister();
    await fillRegister(user, { displayName: ' ', username: ' ', password: ' ', confirmPassword: ' ' });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(localStorage.getItem('writespace_users')).toBeNull();
    expect(getSession()).toBeNull();
  });

  it('rejects mismatched passwords inline and permits correction', async () => {
    const { user, onSessionChange } = setupRegister();
    await fillRegister(user, { ...demoFields, confirmPassword: 'different' });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Confirm Password *')).toHaveAccessibleDescription('Passwords must match.');
    expect(getUsers()).toEqual([]);
    expect(onSessionChange).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Confirm Password *'));
    await user.type(screen.getByLabelText('Confirm Password *'), demoFields.password);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Writer home' })).toBeVisible();
    expect(onSessionChange).toHaveBeenCalledTimes(1);
  });

  it.each(['admin', 'ADMIN', ' Admin '])('rejects reserved username %s using the helper error', async (username) => {
    const { user, onSessionChange } = setupRegister();
    await fillRegister(user, { ...demoFields, username });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Username *')).toHaveAccessibleDescription('Username is already taken.');
    expect(screen.getByRole('alert').textContent).toBe('Username is already taken.');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
  });

  it.each(['user', 'admin'])('rejects a case-insensitive duplicate stored %s without changing accounts', async (role) => {
    const existing = { id: 'existing', displayName: 'Existing Writer', username: 'Demo-Writer', password: 'existing-dummy', role, createdAt: '2025-01-01T00:00:00.000Z' };
    saveUsers([existing]);
    const { user, onSessionChange } = setupRegister();
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Username *')).toHaveAccessibleDescription('Username is already taken.');
    expect(getUsers()).toEqual([existing]);
    expect(getSession()).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
  });

  it('saves a trimmed writer with UUID, timestamp and plaintext password only in the account', async () => {
    const { user, onSessionChange } = setupRegister();
    await fillRegister(user, { ...demoFields, displayName: ' Demo Writer ', username: ' demo-writer ' });
    await user.click(screen.getByRole('button', { name: 'Register' }));
    const [account] = JSON.parse(localStorage.getItem('writespace_users'));
    expect(account).toEqual({ id: expect.any(String), displayName: 'Demo Writer', username: 'demo-writer', password: 'dummy-only', role: 'user', createdAt: expect.any(String) });
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(Number.isFinite(Date.parse(account.createdAt))).toBe(true);
    expect(account).not.toHaveProperty('confirmPassword');
    expect(getSession()).toEqual({ userId: account.id, username: 'demo-writer', displayName: 'Demo Writer', role: 'user' });
    expect(getSession()).not.toHaveProperty('password');
    expect(getSession()).not.toHaveProperty('confirmPassword');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(onSessionChange).toHaveBeenCalledTimes(1);
  });

  it('keeps an account saved when session writing fails and explains login recovery', async () => {
    const { user, onSessionChange } = setupRegister();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'writespace_session') throw new DOMException('Blocked', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save session in this browser.');
    expect(screen.getByRole('alert')).toHaveTextContent('Your account may already be saved. Restore storage access and use Login with the same credentials.');
    expect(getUsers()).toHaveLength(1);
    expect(getUsers()[0].password).toBe(demoFields.password);
    expect(getSession()).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });

  it('does not report success when saving the account fails', async () => {
    const { user, onSessionChange } = setupRegister();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save accounts in this browser.');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });

  it.each(['{broken', 'blocked'])('preserves unreadable account data (%s) and stays on registration', async (raw) => {
    if (raw === 'blocked') {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    } else {
      localStorage.setItem('writespace_users', raw);
    }
    const { user, onSessionChange } = setupRegister();
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not read accounts in this browser.');
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    if (raw !== 'blocked') expect(localStorage.getItem('writespace_users')).toBe(raw);
  });

  it.each(['user', 'admin'])('App redirects authenticated %s away from registration', (role) => {
    setSession({ userId: 'saved', username: 'saved', displayName: 'Saved Writer', role });
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Location />
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(screen.queryByRole('form', { name: 'Register' })).not.toBeInTheDocument();
  });

  it('App uses persisted registration for navbar, reload and profile logout', async () => {
    const view = render(
      <MemoryRouter initialEntries={['/register']}>
        <Location />
        <App />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await fillRegister(user);
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(screen.getByRole('button', { name: 'Profile for Demo Writer' })).toBeVisible();
    const persisted = getSession();
    view.unmount();
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Location />
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getSession()).toEqual(persisted);
    await user.click(screen.getByRole('button', { name: 'Profile for Demo Writer' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(getUsers()).toHaveLength(1);
    const nav = screen.getByRole('navigation', { name: 'Public navigation' });
    await user.click(within(nav).getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('form', { name: 'Login' })).toBeVisible();
  });
});
