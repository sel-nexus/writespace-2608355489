/** Verify linked post content, ordering accents, and ownership presentation. */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BlogCard } from './BlogCard';

const post = {
  id: 'post-1', title: 'An ordinary day', content: 'A little writing.',
  createdAt: '2025-01-02T23:00:00.000Z', authorId: 'user-1', authorName: 'Alex',
};

/** Render one card in a router without changing its data.
 * @param {object} props Optional component props.
 * @returns {object} Testing Library render result.
 */
function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <BlogCard post={post} {...props} />
    </MemoryRouter>,
  );
}

describe('BlogCard', () => {
  it('renders title, excerpt, author, and formatted date with reader link', () => {
    renderCard();
    expect(screen.getByRole('link', { name: post.title })).toHaveAttribute('href', '/blog/post-1');
    expect(screen.getByText(post.content)).toBeVisible();
    expect(screen.getByText('By Alex')).toBeVisible();
    expect(screen.getByText('Jan 02, 2025')).toHaveAttribute('dateTime', post.createdAt);
    expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
  });

  it.each([119, 120, 121, 5000])('shows exactly the first 120 characters at length %s', (length) => {
    renderCard({ post: { ...post, content: 'a'.repeat(length) } });
    expect(screen.getByText('a'.repeat(Math.min(length, 120)) + (length > 120 ? '…' : ''))).toBeVisible();
    if (length > 120) expect(screen.queryByText('a'.repeat(length))).not.toBeInTheDocument();
  });

  it.each([
    [0, 'border-indigo-500'], [1, 'border-violet-500'],
    [2, 'border-pink-500'], [3, 'border-teal-500'], [4, 'border-indigo-500'],
  ])('uses the accent for display index %s', (index, accent) => {
    renderCard({ index });
    expect(screen.getByRole('article')).toHaveClass('border-t-4', accent);
  });

  it.each([
    ['admin', 'other', true], ['user', 'user-1', true], ['user', 'other', false],
  ])('shows edit for role %s and identity %s only when allowed', (role, userId, allowed) => {
    renderCard({ session: { role, userId } });
    const edit = screen.queryByRole('link', { name: `Edit ${post.title}` });
    if (allowed) {
      expect(edit).toHaveAttribute('href', '/edit/post-1');
    } else {
      expect(edit).not.toBeInTheDocument();
    }
  });

  it('encodes route IDs and treats markup as text, never executable HTML', () => {
    const { container } = renderCard({
      post: { ...post, id: 'a/b ?', title: '<script>alert(1)</script>', content: '<img src=x onerror=alert(1)>' },
    });
    expect(screen.getByRole('link', { name: '<script>alert(1)</script>' }))
      .toHaveAttribute('href', '/blog/a%2Fb%20%3F');
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(container.querySelector('script, img')).toBeNull();
  });
});
