/** Verify exact product role avatars and neutral unknown identities. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, getAvatar } from './Avatar';

describe('Avatar', () => {
  it.each([
    ['admin', 'Admin avatar', '👑', 'bg-violet-600'],
    ['user', 'User avatar', '📖', 'bg-indigo-500'],
  ])('renders %s emoji and exact role color', (role, label, emoji, color) => {
    render(<Avatar role={role} />);
    expect(screen.getByRole('img', { name: label })).toHaveClass(color, 'rounded-full');
    expect(screen.getByRole('img', { name: label })).toHaveTextContent(emoji);
  });

  it.each(['guest', 'Admin', 'toString', '__proto__', '', undefined, null])('keeps unknown role %s neutral', (role) => {
    render(getAvatar(role));
    expect(screen.getByRole('img', { name: 'Unknown role avatar' })).toHaveClass('bg-slate-500');
    expect(screen.getByRole('img')).toHaveTextContent('?');
    expect(screen.getByRole('img')).not.toHaveClass('bg-violet-600', 'bg-indigo-500');
  });

  it('exports a JSX helper for other author and account consumers', () => {
    render(getAvatar('admin'));
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toHaveTextContent('👑');
  });
});
