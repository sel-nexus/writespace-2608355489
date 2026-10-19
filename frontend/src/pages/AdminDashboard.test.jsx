/** Verify real overview data, recent post navigation, confirmations, and access denials. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminDashboard from './AdminDashboard';
import { getPosts, savePosts, saveUsers } from '../utils/storage';

const admin = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const posts = Array.from({ length: 7 }, (_, index) => ({ id: `post-${index}`, title: `Story ${index}`, content: 'Content', authorId: 'other', authorName: 'Other Writer', createdAt: `2025-01-0${index + 1}T00:00:00.000Z` }));

/** Mount dashboard with observable real router destinations.
 * @param {object|null} session Candidate identity.
 * @returns {object} Interaction driver.
 */
function setup(session = admin) {
  render(<MemoryRouter initialEntries={['/admin']}><Routes>
    <Route path="/admin" element={<AdminDashboard session={session} />} />
    <Route path="/write" element={<h1>Write destination</h1>} />
    <Route path="/users" element={<h1>Users destination</h1>} />
    <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
    <Route path="/blog/:id" element={<h1>Read destination</h1>} />
    <Route path="/blogs" element={<h1>Blogs destination</h1>} />
    <Route path="/login" element={<h1>Login destination</h1>} />
  </Routes></MemoryRouter>);
  return { user: userEvent.setup() };
}

describe('AdminDashboard', () => {
  it('shows four real counts including builtin and explicit registered repetition plus newest five', () => {
    savePosts(posts);
    saveUsers(['user', 'admin', 'user'].map((role, index) => ({ id: `user-${index}`, username: `local-${index}`, displayName: 'Local', password: 'dummy', role, createdAt: '2025-01-01T00:00:00.000Z' })));
    setup();
    for (const [label, count] of [['Total Posts', 7], ['Total Users', 4], ['Total Admins', 2], ['Total users (repeated)', 3]]) {
      expect(within(screen.getByLabelText(label)).getByText(String(count))).toBeVisible();
    }
    expect(screen.getByText(/requested duplication is retained explicitly/)).toBeVisible();
    const recent = screen.getByRole('region', { name: 'Recent posts' });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(5);
    expect(within(recent).getAllByRole('link').filter((link) => link.textContent.startsWith('Story')).map((link) => link.textContent)).toEqual(['Story 6', 'Story 5', 'Story 4', 'Story 3', 'Story 2']);
    expect(screen.queryByText('Story 1')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Story 6' })).toHaveAttribute('href', '/edit/post-6');
  });
  it('shows truthful empty data and builtin counts', () => {
    setup();
    expect(screen.getByText(/No posts yet/)).toBeVisible();
    expect(within(screen.getByLabelText('Total Users')).getByText('1')).toBeVisible();
    expect(within(screen.getByLabelText('Total Admins')).getByText('1')).toBeVisible();
    expect(within(screen.getByLabelText('Total users (repeated)')).getByText('0')).toBeVisible();
  });
  it.each([['Write New Post', 'Write destination'], ['Manage Users', 'Users destination'], ['Edit Story 6', 'Edit destination'], ['Story 6', 'Read destination']])('navigates %s via a real link', async (label, destination) => {
    savePosts(posts);
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: label, exact: true }));
    expect(screen.getByRole('heading', { name: destination })).toBeVisible();
  });
  it('cancel confirms no mutation, accept deletes another author and requeries newest fifth', async () => {
    savePosts(posts);
    const { user } = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(confirm).toHaveBeenCalledWith('Delete "Story 6"? This cannot be undone.');
    expect(writes).not.toHaveBeenCalled();
    expect(getPosts()).toEqual(posts);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(getPosts()).toEqual(posts.slice(0, 6));
    expect(screen.queryByText('Story 6')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Story 1', exact: true })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Post deleted.');
    expect(within(screen.getByLabelText('Total Posts')).getByText('6')).toBeVisible();
  });
  it.each(['quota', 'missing', 'corrupt', 'discarded'])('reports deletion %s explicitly with no success', async (failure) => {
    savePosts([posts[6]]);
    const { user } = setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    if (failure === 'missing') savePosts([]);
    if (failure === 'corrupt') localStorage.setItem('writespace_posts', '{broken');
    if (failure === 'discarded') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(screen.getByRole('alert')).toHaveTextContent(failure === 'quota' ? 'Could not save posts' : failure === 'missing' ? 'Post not found' : failure === 'corrupt' ? 'Could not read posts safely' : 'Could not verify post deletion');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    if (failure === 'quota' || failure === 'discarded') expect(getPosts()).toEqual([posts[6]]);
  });
  it.each(['{broken', 'blocked'])('reports unreadable accounts %s gracefully', (failure) => {
    if (failure === 'blocked') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    else localStorage.setItem('writespace_users', failure);
    setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not read accounts safely');
    expect(screen.getByText(/No posts yet/)).toBeVisible();
  });
  it.each([null, {}, { ...admin, role: 'user' }])('denies candidate session %j', (session) => {
    setup(session);
    expect(screen.getByRole('heading', { name: session?.role === 'user' ? 'Blogs destination' : 'Login destination' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Publication statistics' })).not.toBeInTheDocument();
  });
});
