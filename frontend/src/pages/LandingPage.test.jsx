/** Verify discovery with real browser storage and navigation through the app. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { FormField } from '../components/FormField';
import { savePosts } from '../utils/storage';

const posts = [1, 4, 2, 3].map((day) => ({
  id: `post-${day}`, title: `Story ${day}`, content: `Real local writing from day ${day}.`,
  authorId: 'writer-1', authorName: 'Local Writer', createdAt: `2025-01-0${day}T12:00:00.000Z`,
}));

/** Render the current discovery route with the real public shell.
 * @returns {object} Testing Library render result.
 */
function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('shows brand, tagline, three features, footer and empty state without seeds', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your thoughts.Your space.Beautifully simple.',
    );
    for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
      expect(screen.getByRole('heading', { name })).toBeVisible();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(within(screen.getByRole('complementary')).getByText('Your first story belongs here.')).toBeVisible();
    expect(screen.getByText(`© ${new Date().getFullYear()} WriteSpace`)).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBeNull();
    expect(screen.queryByRole('article', { name: /Story/ })).not.toBeInTheDocument();
  });

  it('shows the newest three in order and reuses the newest real card in the mini preview', () => {
    savePosts(posts);
    renderLanding();
    const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
    expect(within(latest).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
      .toEqual(['Story 4', 'Story 3', 'Story 2']);
    expect(within(latest).getAllByRole('article')).toHaveLength(3);
    expect(within(latest).getAllByRole('article')[0]).toHaveClass('border-indigo-500');
    expect(within(latest).getAllByRole('article')[1]).toHaveClass('border-violet-500');
    expect(within(latest).getAllByRole('article')[2]).toHaveClass('border-pink-500');
    expect(screen.queryByText('Story 1')).not.toBeInTheDocument();
    const mini = screen.getByRole('complementary');
    expect(within(mini).getByRole('link', { name: 'Story 4' })).toHaveAttribute('href', '/blog/post-4');
    expect(within(mini).getByText('Real local writing from day 4.')).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBe(JSON.stringify(posts));
    expect(screen.queryByText('No posts yet — check back soon!')).not.toBeInTheDocument();
  });

  it('renders fewer than three posts without inventing additional cards', () => {
    savePosts([posts[0]]);
    renderLanding();
    expect(within(screen.getByRole('region', { name: 'Latest from the Blog' })).getAllByRole('article'))
      .toHaveLength(1);
  });

  it.each(['broken-json', JSON.stringify([{}])])('shows the empty state for corrupt storage %s', (raw) => {
    localStorage.setItem('writespace_posts', raw);
    renderLanding();
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
  });

  it('shows the empty state when reading browser storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    renderLanding();
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
  });

  it.each([
    ['Start Reading', '/login'], ['Get Started Free', '/register'], ['Start your story', '/register'],
  ])('navigates the guest CTA %s to %s and allows return by link', async (name, path) => {
    renderLanding();
    const user = userEvent.setup();
    const link = screen.getByRole('link', { name, exact: true });
    expect(link).toHaveAttribute('href', path);
    await user.click(link);
    expect(screen.getByRole('heading', { name: path === '/login' ? 'Welcome back' : 'Create your account' })).toBeVisible();
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'WriteSpace.' }));
    expect(screen.getByRole('heading', { name: 'Latest from the Blog' })).toBeVisible();
  });

  it('exposes public navbar, footer, and post routes without adding other feature pages', async () => {
    savePosts([posts[0]]);
    renderLanding();
    const navbar = screen.getByRole('navigation', { name: 'Public navigation' });
    expect(within(navbar).getByRole('link', { name: 'WriteSpace.' })).toHaveAttribute('href', '/');
    expect(within(navbar).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(within(navbar).getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
    const footer = screen.getByRole('navigation', { name: 'Footer navigation' });
    for (const [name, path] of [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
      expect(within(footer).getByRole('link', { name })).toHaveAttribute('href', path);
    }
    await userEvent.setup().click(within(screen.getByRole('region', { name: 'Latest from the Blog' }))
      .getByRole('link', { name: 'Story 1' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

describe('shared FormField scaffold', () => {
  it('labels the input and sends native changes to its consumer', async () => {
    const onChange = vi.fn();
    render(
      <FormField id="title" label="Title" required onChange={onChange} />,
    );
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    await userEvent.setup().type(input, 'Idea');
    expect(input).toHaveValue('Idea');
    expect(onChange).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('associates inline validation and preserves disabled state', () => {
    render(
      <FormField id="title" label="Title" error="Title is required." disabled />,
    );
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Title is required.');
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.');
  });
});
