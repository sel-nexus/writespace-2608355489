/** Verify accessible draft validation, persistence, metadata preservation and cancel behavior. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WriteBlog from './WriteBlog';
import { getPosts, savePosts } from '../utils/storage';

const owner = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const post = {
  id: 'story', title: 'Original title', content: 'Original\n\n content',
  createdAt: '2025-01-02T00:00:00.000Z', authorId: 'writer', authorName: 'Original Writer',
};

/** Observe navigation without mocking the router.
 * @returns {JSX.Element} Current route output.
 */
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

/** Mount writing with real route destinations.
 * @param {object} options Edit mode and candidate identity.
 * @returns {object} User driver and rendering handle.
 */
function setup({ editing = false, session = owner } = {}) {
  const view = render(
    <MemoryRouter initialEntries={[editing ? '/edit/story' : '/write']}>
      <Location />
      <Routes>
        <Route path="/write" element={<WriteBlog session={session} />} />
        <Route path="/edit/:id" element={<WriteBlog session={session} editing />} />
        <Route path="/blog/:id" element={<h1>Reader destination</h1>} />
        <Route path="/blogs" element={<h1>All Blogs destination</h1>} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, user: userEvent.setup() };
}

/** Fill native draft fields through accessible labels.
 * @param {object} user Interaction driver.
 * @param {string} title Draft title.
 * @param {string} content Draft content.
 * @returns {Promise<void>} Completed typing.
 */
async function fill(user, title = 'New title', content = 'First line\n\n<script>plain text</script>') {
  await user.clear(screen.getByLabelText('Title *'));
  if (title) await user.type(screen.getByLabelText('Title *'), title);
  await user.clear(screen.getByLabelText('Content *'));
  if (content) await user.type(screen.getByLabelText('Content *'), content);
}

describe('WriteBlog', () => {
  it('has required full-width native fields, minimum textarea height and live character count', async () => {
    const { user } = setup();
    expect(screen.getByRole('form', { name: 'Write New Post' })).toHaveAttribute('novalidate');
    const title = screen.getByLabelText('Title *');
    const content = screen.getByLabelText('Content *');
    for (const field of [title, content]) {
      expect(field).toBeRequired();
      expect(field).toHaveAttribute('aria-required', 'true');
      expect(field).toHaveAttribute('aria-invalid', 'false');
      expect(field).toHaveClass('w-full');
    }
    expect(content.tagName).toBe('TEXTAREA');
    expect(content).toHaveClass('min-h-64');
    expect(screen.getByRole('status', { name: 'Character count' })).toHaveTextContent('0 characters');
    await user.type(content, 'abc\ndef');
    expect(screen.getByRole('status', { name: 'Character count' })).toHaveTextContent('7 characters');
    await user.clear(content);
    expect(screen.getByRole('status', { name: 'Character count' })).toHaveTextContent('0 characters');
  });

  it.each(['', ' \n '])('shows both field-level accessible errors for blank inputs %j and saves nothing', async (blank) => {
    const { user } = setup();
    await fill(user, blank, blank);
    await user.click(screen.getByRole('button', { name: 'Save Post' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByLabelText('Title *')).toHaveAccessibleDescription('Title is required.');
    expect(screen.getByLabelText('Content *')).toHaveAccessibleDescription(new RegExp('Content is required.'));
    expect(screen.getByLabelText('Content *')).toHaveAttribute('aria-invalid', 'true');
    expect(localStorage.getItem('writespace_posts')).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/write');
  });

  it.each(['title', 'content'])('only flags missing %s and permits correction without clearing unrelated drafts', async (missing) => {
    const { user } = setup();
    await fill(user, missing === 'title' ? '' : 'Title', missing === 'content' ? '' : 'Content');
    await user.click(screen.getByRole('button', { name: 'Save Post' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const field = screen.getByLabelText(missing === 'title' ? 'Title *' : 'Content *');
    await user.type(field, 'Corrected');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Post' }));
    expect(getPosts()).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Reader destination' })).toBeVisible();
  });

  it.each(['user', 'admin'])('creates UUID/timestamp/current author for %s, preserves plain text and redirects', async (role) => {
    const session = { ...owner, role };
    const { user } = setup({ session });
    const content = '  First line\n\n<script>alert(1)</script>  ';
    await fill(user, ' New title ', content);
    expect(screen.getByLabelText('Content *')).toHaveValue(content);
    expect(document.querySelector('script')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save Post' }));
    const [stored] = getPosts();
    expect(stored).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i), title: 'New title', content,
      createdAt: expect.any(String), authorId: owner.userId, authorName: owner.displayName,
    });
    expect(Number.isFinite(Date.parse(stored.createdAt))).toBe(true);
    expect(screen.getByLabelText('Current route')).toHaveTextContent(`/blog/${stored.id}`);
  });

  it.each(['user', 'admin'])('prefills %s edits and preserves id/date/original authorship on save', async (role) => {
    savePosts([post]);
    const { user } = setup({ editing: true, session: { ...owner, role, userId: role === 'admin' ? 'admin' : owner.userId } });
    expect(screen.getByLabelText('Title *')).toHaveValue(post.title);
    expect(screen.getByLabelText('Content *')).toHaveValue(post.content);
    expect(screen.getByRole('status', { name: 'Character count' })).toHaveTextContent(`${post.content.length} characters`);
    await fill(user, ' Changed ', 'Changed\ncontent');
    await user.click(screen.getByRole('button', { name: 'Save Post' }));
    expect(getPosts()).toEqual([{ ...post, title: 'Changed', content: 'Changed\ncontent' }]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blog/story');
  });

  it.each([false, true])('cancel edit mode %s returns without writing draft changes', async (editing) => {
    savePosts([post]);
    const { user } = setup({ editing });
    await fill(user);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(writes).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([post]);
    expect(screen.getByLabelText('Current route')).toHaveTextContent(editing ? '/blog/story' : '/blogs');
  });

  it('redirects another writer away from edit without form or writes', () => {
    savePosts([post]);
    setup({ editing: true, session: { ...owner, userId: 'other' } });
    expect(screen.getByRole('heading', { name: 'All Blogs destination' })).toBeVisible();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });

  it.each([null, {}, { ...owner, role: 'guest' }])('redirects invalid session %j on write and edit', (session) => {
    savePosts([post]);
    setup({ editing: true, session });
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeVisible();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });

  it.each(['missing', 'corrupt', 'blocked'])('missing edit %s shows not-found and back link', async (state) => {
    if (state === 'corrupt') localStorage.setItem('writespace_posts', '[{}]');
    if (state === 'blocked') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    const { user } = setup({ editing: true });
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to All Posts' }));
    expect(screen.getByRole('heading', { name: 'All Blogs destination' })).toBeVisible();
  });

  it.each(['quota', 'UUID', 'corrupt', 'blocked'])('reports create failure %s, preserving draft and storage', async (failure) => {
    const { user } = setup();
    await fill(user);
    if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    if (failure === 'UUID') vi.spyOn(window.crypto, 'randomUUID').mockImplementation(() => { throw new Error('Unavailable'); });
    if (failure === 'corrupt') localStorage.setItem('writespace_posts', '{broken');
    if (failure === 'blocked') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    await user.click(screen.getByRole('button', { name: 'Save Post' }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByLabelText('Title *')).toHaveValue('New title');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/write');
    if (failure === 'corrupt') expect(localStorage.getItem('writespace_posts')).toBe('{broken');
    else if (failure !== 'blocked') expect(getPosts()).toEqual([]);
  });

  it.each(['quota', 'ownership', 'missing', 'corrupt'])('rechecks edit state on save and reports %s without writes/false success', async (failure) => {
    savePosts([post]);
    const { user } = setup({ editing: true });
    await fill(user);
    if (failure === 'quota') vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
    if (failure === 'ownership') savePosts([{ ...post, authorId: 'other' }]);
    if (failure === 'missing') savePosts([]);
    if (failure === 'corrupt') localStorage.setItem('writespace_posts', '{broken');
    await user.click(screen.getByRole('button', { name: 'Save Post' }));
    expect(screen.queryByRole('heading', { name: 'Reader destination' })).not.toBeInTheDocument();
    if (failure === 'quota') {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not save posts');
      expect(getPosts()).toEqual([post]);
    } else if (failure === 'ownership') {
      expect(screen.getByRole('heading', { name: 'All Blogs destination' })).toBeVisible();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Back to All Posts' })).toHaveAttribute('href', '/blogs');
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    }
    if (failure === 'ownership') expect(getPosts()[0].authorId).toBe('other');
    if (failure === 'missing') expect(getPosts()).toEqual([]);
    if (failure === 'corrupt') expect(localStorage.getItem('writespace_posts')).toBe('{broken');
  });
});
