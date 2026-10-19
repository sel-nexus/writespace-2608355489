/** Verify escaped reading, permissions, confirmation and real deletion persistence. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ReadBlog from './ReadBlog';
import { getPosts, savePosts } from '../utils/storage';

const owner = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const post = {
  id: 'story', title: '<b>Plain title</b>', content: '  First line\n\n<script>alert(1)</script>  ',
  createdAt: '2025-03-09T00:00:00.000Z', authorId: 'writer', authorName: 'Writer',
};

/** Mount the reader and real navigation destinations.
 * @param {object|null} session Candidate identity.
 * @param {string} id Initial resource identity.
 * @returns {object} Rendering handle.
 */
function setup(session = owner, id = 'story') {
  return render(
    <MemoryRouter initialEntries={[`/blog/${id}`]}>
      <Routes>
        <Route path="/blog/:id" element={<ReadBlog session={session} />} />
        <Route path="/blogs" element={<h1>All Blogs destination</h1>} />
        <Route path="/edit/:id" element={<h1>Edit destination</h1>} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReadBlog', () => {
  it('renders full escaped text, whitespace, author, emoji and formatted date', () => {
    savePosts([post]);
    setup();
    const heading = screen.getByRole('heading', { name: post.title });
    expect(heading.querySelector('b')).toBeNull();
    const content = screen.getByText((_, element) => element?.textContent === post.content);
    expect(content).toHaveClass('whitespace-pre-wrap');
    expect(content.textContent).toBe(post.content);
    expect(content.querySelector('script')).toBeNull();
    expect(screen.getByText('Writer')).toBeVisible();
    expect(screen.getByRole('img', { name: 'User avatar' })).toHaveTextContent('📖');
    expect(screen.getByText('Mar 09, 2025')).toHaveAttribute('datetime', post.createdAt);
  });

  it.each(['user', 'admin'])('allows authorized %s edit navigation', async (role) => {
    savePosts([post]);
    setup({ ...owner, role, userId: role === 'admin' ? 'admin' : 'writer' });
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Edit', exact: true }));
    expect(screen.getByRole('heading', { name: 'Edit destination' })).toBeVisible();
    expect(getPosts()).toEqual([post]);
  });

  it('other users have only Back to All Posts and cannot mutate', async () => {
    savePosts([post]);
    setup({ ...owner, userId: 'other' });
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByRole('heading', { name: 'All Blogs destination' })).toBeVisible();
    expect(getPosts()).toEqual([post]);
  });

  it.each(['user', 'admin'])('confirmed %s deletion removes only selected post and redirects', async (role) => {
    const unrelated = { ...post, id: 'unrelated' };
    savePosts([post, unrelated]);
    setup({ ...owner, role, userId: role === 'admin' ? 'admin' : 'writer' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(getPosts()).toEqual([unrelated]);
    expect(screen.getByRole('heading', { name: 'All Blogs destination' })).toBeVisible();
  });

  it('rejected confirmation stays in reader with no writes', async () => {
    savePosts([post]);
    setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(writes).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post]);
    expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  });

  it.each(['quota', 'corrupt', 'missing', 'ownership', 'blocked'])('reports deletion failure %s without false redirect', async (failure) => {
    savePosts([post]);
    setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    if (failure === 'corrupt') localStorage.setItem('writespace_posts', '{broken');
    if (failure === 'missing') savePosts([]);
    if (failure === 'ownership') savePosts([{ ...post, authorId: 'other' }]);
    if (failure === 'blocked') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'All Blogs destination' })).not.toBeInTheDocument();
    if (failure === 'quota') expect(getPosts()).toEqual([post]);
    if (failure === 'corrupt') expect(localStorage.getItem('writespace_posts')).toBe('{broken');
    if (failure === 'ownership') expect(getPosts()[0].authorId).toBe('other');
  });

  it.each(['missing', 'corrupt', 'blocked'])('shows not-found/back for %s resource state', async (state) => {
    if (state === 'corrupt') localStorage.setItem('writespace_posts', '[{}]');
    if (state === 'blocked') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    setup();
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByRole('heading', { name: 'All Blogs destination' })).toBeVisible();
  });

  it.each([null, {}, { ...owner, role: 'guest' }])('rejects invalid session %j', (session) => {
    savePosts([post]);
    setup(session);
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeVisible();
    expect(getPosts()).toEqual([post]);
  });
});
