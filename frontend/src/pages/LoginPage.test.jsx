/** Exercise login with real demo helpers, jsdom storage, and router transitions. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import LoginPage from './LoginPage';
import { getSession, setSession } from '../utils/auth';
import { saveUsers } from '../utils/storage';

/** Expose actual router location without replacing navigation with a mock.
 * @returns {JSX.Element} Current path.
 */
function Location() {
  const { pathname } = useLocation();
  return <output aria-label="Current route">{pathname}</output>;
}

/** Mount the page and observe persistence at callback time, before navigation.
 * @returns {object} User interaction and callback probe.
 */
function setupLogin() {
  const onSessionChange = vi.fn(() => {
    expect(getSession()).not.toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Location />
      <Routes>
        <Route path="/login" element={<LoginPage onSessionChange={onSessionChange} />} />
        <Route path="/blogs" element={<h1>Writer home</h1>} />
        <Route path="/admin" element={<h1>Admin home</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return { user: userEvent.setup(), onSessionChange };
}

/** Enter exact demo credentials through native fields.
 * @param {object} user User-event driver.
 * @param {string} username Demo username.
 * @param {string} password Demo password.
 * @returns {Promise<void>} Completed input interactions.
 */
async function fillLogin(user, username = 'admin', password = 'admin') {
  await user.type(screen.getByLabelText('Username', { exact: false }), username);
  await user.type(screen.getByLabelText('Password', { exact: false }), password);
}

describe('LoginPage', () => {
  it('labels required native fields, autocomplete, demo warning and register link', () => {
    setupLogin();
    const username = screen.getByLabelText(/Username/);
    const password = screen.getByLabelText(/Password/);
    expect(username).toBeRequired();
    expect(password).toBeRequired();
    expect(username).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.getByText(/passwords are stored in plaintext/)).toHaveTextContent('non-sensitive demo credentials, never a real password');
    expect(screen.getByText(/admin \/ admin/)).toBeVisible();
  });

  it.each(['Username', 'Password'])('blocks a missing %s with an associated inline error', async (missing) => {
    const { user, onSessionChange } = setupLogin();
    const other = missing === 'Username' ? 'Password' : 'Username';
    await user.type(screen.getByLabelText(new RegExp(other)), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    const input = screen.getByLabelText(new RegExp(missing));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(`${missing} is required.`);
    expect(screen.getByRole('alert')).toHaveTextContent(`${missing} is required.`);
    expect(getSession()).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });

  it('validates both blank fields and whitespace without persisting', async () => {
    const { user } = setupLogin();
    await fillLogin(user, '   ', '   ');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });

  it('shows exact bad-credential feedback and allows correction to built-in admin', async () => {
    const { user, onSessionChange } = setupLogin();
    await fillLogin(user, 'admin', 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert').textContent).toBe('Invalid username or password.');
    expect(screen.getByLabelText(/Password/)).toHaveAccessibleDescription('Invalid username or password.');
    expect(getSession()).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/Password/));
    await user.type(screen.getByLabelText(/Password/), 'admin');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Admin home' })).toBeVisible();
    expect(getSession()).toEqual({ userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' });
    expect(onSessionChange).toHaveBeenCalledTimes(1);
    expect(getSession()).not.toHaveProperty('password');
  });

  it.each(['user', 'admin'])('logs in a stored %s, persists identity and navigates after refresh', async (role) => {
    const account = { id: 'saved-account', username: 'local', displayName: 'Local Writer', password: 'dummy-only', role, createdAt: '2025-01-01T00:00:00.000Z' };
    saveUsers([account]);
    const { user, onSessionChange } = setupLogin();
    await fillLogin(user, 'local', 'dummy-only');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(getSession()).toEqual({ userId: account.id, username: account.username, displayName: account.displayName, role });
    expect(getSession()).not.toHaveProperty('password');
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([account]);
    expect(onSessionChange).toHaveBeenCalledTimes(1);
  });

  it('does not refresh or navigate when writing the session fails', async () => {
    const { user, onSessionChange } = setupLogin();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'QuotaExceededError');
    });
    await fillLogin(user);
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save session in this browser.');
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });

  it.each(['{broken', 'blocked'])('reports unreadable accounts (%s) without false login', async (raw) => {
    if (raw === 'blocked') {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    } else {
      localStorage.setItem('writespace_users', raw);
    }
    const { user, onSessionChange } = setupLogin();
    await fillLogin(user, 'writer', 'dummy');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not read accounts in this browser.');
    expect(onSessionChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  });

  it.each(['user', 'admin'])('App redirects authenticated %s away from login', (role) => {
    setSession({ userId: 'saved', username: 'saved', displayName: 'Saved Reader', role });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Location />
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(screen.queryByRole('form', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Authenticated navigation' })).toBeVisible();
  });

  it('App refreshes navigation from a real login and links to registration', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Location />
        <App />
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Register' }));
    expect(screen.getByRole('form', { name: 'Register' })).toBeVisible();
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Login' }));
    await fillLogin(user);
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin');
    expect(screen.getByRole('button', { name: 'Profile for Admin' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Public navigation' })).not.toBeInTheDocument();
  });
});
