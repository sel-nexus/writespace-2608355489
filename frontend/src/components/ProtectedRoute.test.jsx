/** Verify fail-closed route access for guests, writers and administrators. */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

const writer = { userId: 'writer-id', username: 'writer', displayName: 'Writer', role: 'user' };
const admin = { ...writer, userId: 'admin', username: 'admin', role: 'admin' };

/** Expose destination and navigation type for redirect assertions.
 * @returns {JSX.Element} Current pathname.
 */
function Destination() {
  const location = useLocation();
  return <p>{location.pathname}</p>;
}

/** Mount a guard inside real routing, with explicit or nested content.
 * @param {object|null} session Identity under test.
 * @param {boolean} adminOnly Whether administrator access is required.
 * @param {boolean} nested Whether to test Outlet composition.
 * @returns {void}
 */
function renderGuard(session, adminOnly = false, nested = false) {
  render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        {nested ? (
          <Route element={<ProtectedRoute session={session} adminOnly={adminOnly} />}>
            <Route path="/protected" element={<h1>Protected content</h1>} />
          </Route>
        ) : (
          <Route path="/protected" element={
            <ProtectedRoute session={session} adminOnly={adminOnly}>
              <h1>Protected content</h1>
            </ProtectedRoute>
          } />
        )}
        <Route path="/login" element={<Destination />} />
        <Route path="/blogs" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it.each([false, true])('sends guests to login for adminOnly=%s', (adminOnly) => {
    renderGuard(null, adminOnly);
    expect(screen.getByText('/login')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it.each([false, true])('allows users on normal routes using nested=%s', (nested) => {
    renderGuard(writer, false, nested);
    expect(screen.getByRole('heading', { name: 'Protected content' })).toBeInTheDocument();
  });

  it('redirects nonadmins to blogs without exposing admin content', () => {
    renderGuard(writer, true);
    expect(screen.getByText('/blogs')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it.each([false, true])('allows admins on adminOnly=%s routes', (adminOnly) => {
    renderGuard(admin, adminOnly);
    expect(screen.getByRole('heading', { name: 'Protected content' })).toBeInTheDocument();
  });

  it('fails closed for a session with blank required identity', () => {
    renderGuard({ ...writer, userId: '' });
    expect(screen.getByText('/login')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('treats omitted session as a guest', () => {
    renderGuard(undefined);
    expect(screen.getByText('/login')).toBeInTheDocument();
  });
});
