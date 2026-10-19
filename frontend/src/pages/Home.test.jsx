/** Verify feed order, real card metadata, ownership and recoverable empty states. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Home from './Home';
import App from '../App';
import { setSession } from '../utils/auth';
import { savePosts, saveUsers } from '../utils/storage';

const owner = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const post = {
  id: 'first', title: 'First story', content: 'x'.repeat(130),
  createdAt: '2025-01-02T00:00:00.000Z', authorId: 'writer', authorName: 'Writer',
};

/** Mount feed with real routes for reader and writing entry points.
 * @param {object|null} session Candidate current identity.
 * @returns {object} Rendering handle.
 */
function setup(session = owner) {
  return render(
    <MemoryRouter initialEntries={['/blogs']}>
      <Routes>
        <Route path="/blogs" element={<Home session={session} />} />
        <Route path="/write" element={<h1>Writing destination</h1>} />
        <Route path="/blog/:id" element={<h1>Reading destination</h1>} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Home feed', () => {
  it('renders newest-first escaped cards, 120-character excerpts, dates, avatars and rotating accents', () => {
    const newer = { ...post, id: 'newer', title: '<script>newest</script>', createdAt: '2025-03-09T00:00:00.000Z', authorId: 'admin' };
    savePosts([post, newer, { ...post, id: 'third' }, { ...post, id: 'fourth' }, { ...post, id: 'fifth' }]);
    setup();
    const feed = screen.getByRole('region', { name: 'All posts' });
    expect(feed).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    const cards = within(feed).getAllByRole('article');
    expect(within(cards[0]).getByRole('heading')).toHaveTextContent('<script>newest</script>');
    expect(cards[0].querySelector('script')).toBeNull();
    expect(within(cards[0]).getByText(`${'x'.repeat(120)}…`)).toBeVisible();
    expect(within(cards[0]).getByText('Mar 09, 2025')).toHaveAttribute('datetime', newer.createdAt);
    expect(within(cards[0]).getByRole('img', { name: 'Admin avatar' })).toHaveTextContent('👑');
    expect(within(cards[1]).getByRole('img', { name: 'User avatar' })).toHaveTextContent('📖');
    const accents = ['border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500', 'border-indigo-500'];
    cards.forEach((card, index) => expect(card).toHaveClass('border-t-4', accents[index]));
    expect(within(cards[0]).queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
    expect(within(cards[1]).getByRole('link', { name: 'Edit First story' })).toHaveAttribute('href', '/edit/first');
  });

  it('admin sees every edit control and registered admin authors use crowns without changing post schema', () => {
    savePosts([post, { ...post, id: 'other', authorId: 'other' }]);
    saveUsers([{ id: 'writer', username: 'writer', displayName: 'Writer', password: 'dummy', role: 'admin', createdAt: post.createdAt }]);
    setup({ ...owner, role: 'admin' });
    expect(screen.getAllByRole('link', { name: /Edit First story/ })).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeVisible();
  });

  it.each(['user', 'admin'])('shows exact empty invitation and working Write entry for %s', async (role) => {
    setup({ ...owner, role });
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Write', exact: true }));
    expect(screen.getByRole('heading', { name: 'Writing destination' })).toBeVisible();
  });

  it.each(['{broken', '[{}]', 'blocked'])('degrades gracefully for corrupt or unavailable storage %s', (raw) => {
    if (raw === 'blocked') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    else localStorage.setItem('writespace_posts', raw);
    setup();
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  });

  it.each([null, {}, { ...owner, displayName: ' ' }])('redirects invalid identity %j instead of rendering writer controls', (session) => {
    setup(session);
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Write New Post' })).not.toBeInTheDocument();
  });

  it('card title navigates to the reader', async () => {
    savePosts([post]);
    setup();
    await userEvent.setup().click(screen.getByRole('link', { name: 'First story', exact: true }));
    expect(screen.getByRole('heading', { name: 'Reading destination' })).toBeVisible();
  });

  it('App passes a valid session to landing Start Reading and preserves navigation into the feed', async () => {
    setSession(owner);
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
    await userEvent.setup().click(screen.getByRole('link', { name: 'Start Reading' }));
    expect(screen.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Authenticated navigation' })).toBeVisible();
  });
});
