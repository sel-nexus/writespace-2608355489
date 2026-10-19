/** Verify role links, responsive disclosures, persistent shell and honest logout state. */
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from './Navbar';
import { PublicNavbar } from './PublicNavbar';
import App from '../App';
import { getSession, setSession } from '../utils/auth';

const writer = { userId: 'writer-id', username: 'writer', displayName: 'Writer', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

/** Show the current route and refresh session only from real storage.
 * @returns {JSX.Element} Navbar harness with visible destination.
 */
function Shell() {
  const [session, updateSession] = useState(getSession);
  const { pathname } = useLocation();
  return (
    <>
      {session ? (
        <Navbar session={session} onSessionChange={() => updateSession(getSession())} />
      ) : (
        <p>Guest session</p>
      )}
      <p data-testid="destination">{pathname}</p>
    </>
  );
}

/** Mount real persisted role state and router.
 * @param {object} session Role fixture.
 * @returns {void}
 */
function renderShell(session = writer) {
  setSession(session);
  render(
    <MemoryRouter initialEntries={['/blogs']}>
      <Shell />
    </MemoryRouter>,
  );
}

/** Expose the actual App destination to distinguish redirects from navbar-only changes.
 * @returns {JSX.Element} Current route pathname.
 */
function AppDestination() {
  const { pathname } = useLocation();
  return <p data-testid="app-destination">{pathname}</p>;
}

/** Mount App at an initial route with an optional persisted fixture.
 * @param {string} route Initial path.
 * @param {object|null} session Optional role fixture.
 * @returns {void}
 */
function renderApp(route, session = null) {
  if (session) setSession(session);
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
      <AppDestination />
    </MemoryRouter>,
  );
}

describe('Navbar', () => {
  it.each([writer, admin])('renders role links and identity for $role', (session) => {
    renderShell(session);
    const nav = screen.getByRole('navigation', { name: 'Authenticated navigation' });
    expect(within(nav).getByRole('link', { name: 'WriteSpace.' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'All Blogs' })).toHaveAttribute('href', '/blogs');
    expect(within(nav).getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
    expect(within(nav).getByRole('button', { name: `Profile for ${session.displayName}` })).toBeInTheDocument();
    expect(within(nav).getByRole('img', { name: session.role === 'admin' ? 'Admin avatar' : 'User avatar' })).toBeInTheDocument();
    if (session.role === 'admin') {
      expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    } else {
      expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(session.role === 'admin' ? 4 : 3);
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  it('updates active pills after navigation and closes mobile links on selection', async () => {
    const user = userEvent.setup();
    renderShell();
    const allBlogs = screen.getByRole('link', { name: 'All Blogs' });
    const write = screen.getByRole('link', { name: 'Write' });
    expect(allBlogs).toHaveAttribute('aria-current', 'page');
    expect(allBlogs).toHaveClass('bg-indigo-600', 'rounded-full');
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls'))).toHaveClass('hidden');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('role-navigation-links')).toHaveClass('flex');
    await user.click(write);
    expect(screen.getByTestId('destination')).toHaveTextContent('/write');
    expect(write).toHaveAttribute('aria-current', 'page');
    expect(write).toHaveClass('bg-indigo-600', 'rounded-full');
    expect(allBlogs).not.toHaveAttribute('aria-current');
    expect(allBlogs).not.toHaveClass('bg-indigo-600');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports profile toggle, Escape and navigation closing the dropdown', async () => {
    const user = userEvent.setup();
    renderShell(admin);
    const profile = screen.getByRole('button', { name: 'Profile for Admin' });
    expect(profile).toHaveAttribute('aria-expanded', 'false');
    await user.click(profile);
    expect(profile).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    await user.click(profile);
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    await user.click(profile);
    await user.keyboard('{Escape}');
    expect(profile).toHaveAttribute('aria-expanded', 'false');
    await user.click(profile);
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    await user.click(profile);
    await user.click(screen.getByRole('link', { name: 'Users' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('/users');
    expect(profile).toHaveAttribute('aria-expanded', 'false');
  });

  it.each([writer, admin])('clears real $role session, refreshes UI and redirects home', async (session) => {
    const user = userEvent.setup();
    renderShell(session);
    await user.click(screen.getByRole('button', { name: `Profile for ${session.displayName}` }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(localStorage.getItem('writespace_session')).toBeNull();
    expect(getSession()).toBeNull();
    expect(screen.getByText('Guest session')).toBeInTheDocument();
    expect(screen.getByTestId('destination')).toHaveTextContent(/^\/$/);
  });

  it('retains route and signed-in UI on failed clear, then supports retry', async () => {
    const user = userEvent.setup();
    renderShell();
    const failure = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: 'Profile for Writer' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not log out');
    expect(getSession()).toEqual(writer);
    expect(screen.getByTestId('destination')).toHaveTextContent('/blogs');
    expect(screen.getByRole('button', { name: 'Profile for Writer' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Guest session')).not.toBeInTheDocument();
    failure.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(screen.getByTestId('destination')).toHaveTextContent(/^\/$/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('App and PublicNavbar role wiring', () => {
  it.each([writer, admin])('shows $role public identity and dashboard destination', (session) => {
    render(
      <MemoryRouter>
        <PublicNavbar session={session} />
      </MemoryRouter>,
    );
    expect(screen.getByText(session.displayName)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', session.role === 'admin' ? '/admin' : '/blogs');
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
  });

  it('preserves public guest navigation and landing discovery', () => {
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
    expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  });

  it.each(['/blogs', '/blog/example', '/write', '/edit/example', '/admin', '/users'])('redirects guest initial entry %s to login', (route) => {
    renderApp(route);
    expect(screen.getByTestId('app-destination')).toHaveTextContent(/^\/login$/);
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Authenticated navigation' })).not.toBeInTheDocument();
  });

  it.each([
    ['/login', admin, '/admin'], ['/register', admin, '/admin'],
    ['/login', writer, '/blogs'], ['/register', writer, '/blogs'],
  ])('redirects authenticated identity entry %s to role home', (route, session, home) => {
    renderApp(route, session);
    expect(screen.getByTestId('app-destination')).toHaveTextContent(home);
    expect(screen.getByRole('navigation', { name: 'Authenticated navigation' })).toBeInTheDocument();
    if (session.role === 'admin') expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Public navigation' })).not.toBeInTheDocument();
  });

  it.each(['/admin', '/users'])('redirects ordinary users from %s to active blog home', (route) => {
    renderApp(route, writer);
    expect(screen.getByTestId('app-destination')).toHaveTextContent(/^\/blogs$/);
    expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('keeps the navbar mounted across protected routes and refreshes App on logout', async () => {
    const user = userEvent.setup();
    renderApp('/blogs', writer);
    const nav = screen.getByRole('navigation', { name: 'Authenticated navigation' });
    await user.click(screen.getByRole('button', { name: 'Profile for Writer' }));
    await user.click(screen.getByRole('link', { name: 'Write' }));
    expect(screen.getByRole('navigation', { name: 'Authenticated navigation' })).toBe(nav);
    expect(screen.getByRole('button', { name: 'Profile for Writer' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'Profile for Writer' }));
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Reading' })).toBeInTheDocument();
  });

  it('fails closed when an initially stored session is malformed', () => {
    localStorage.setItem('writespace_session', '{');
    renderApp('/users');
    expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });
});
