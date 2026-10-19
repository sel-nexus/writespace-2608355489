/** Display a real browser-local dashboard count with a named accent. */
import PropTypes from 'prop-types';

const accents = {
  indigo: 'border-indigo-500 bg-indigo-50 text-indigo-800',
  violet: 'border-violet-500 bg-violet-50 text-violet-800',
  pink: 'border-pink-500 bg-pink-50 text-pink-800',
  teal: 'border-teal-500 bg-teal-50 text-teal-800',
};

/** Associate a count with its visible metric label.
 * @param {object} props Label, nonnegative count, and optional color accent.
 * @returns {JSX.Element} Semantic metric definition.
 */
export function StatCard({ label, count, accent = 'indigo' }) {
  const value = Number.isInteger(count) && count >= 0 ? count : 0;
  return (
    <dl aria-label={label} className={`${accents[accent] ?? accents.indigo} rounded-2xl border-t-4 p-6`}>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-3 text-4xl font-semibold tabular-nums">{value}</dd>
    </dl>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  accent: PropTypes.string,
};
