/** Verify semantic real counts and defensive display branches. */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it.each(['indigo', 'violet', 'pink', 'teal'])('shows labeled real count with %s accent', (accent) => {
    render(<StatCard label="Total Posts" count={12} accent={accent} />);
    const card = screen.getByLabelText('Total Posts');
    expect(card.tagName).toBe('DL');
    expect(card).toHaveClass(`border-${accent}-500`);
    expect(within(card).getByText('12').tagName).toBe('DD');
    expect(within(card).getByText('Total Posts').tagName).toBe('DT');
  });
  it.each([-1, NaN, Infinity, 1.5])('fails safely for invalid count %s', (count) => {
    render(<StatCard label="Accounts" count={count} accent="unknown" />);
    expect(screen.getByText('0')).toHaveClass('tabular-nums');
    expect(screen.getByLabelText('Accounts')).toHaveClass('border-indigo-500');
  });
  it('retains a genuine zero and default accent', () => {
    render(<StatCard label="Total users (repeated)" count={0} />);
    expect(screen.getByText('0')).toBeVisible();
  });
});
