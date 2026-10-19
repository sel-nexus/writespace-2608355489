/** Provide an accessible labeled input for the planned writing and identity forms. */
import PropTypes from 'prop-types';
import { fieldStyle } from '../utils/styles';

/** Associate a label and inline error with a native input.
 * @param {object} props Input identity, value, change handler, and validation state.
 * @returns {JSX.Element} Labeled field with an optional alert.
 */
export function FormField({ id, label, error = '', required = false, ...inputProps }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        {...inputProps}
        id={id}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldStyle}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  error: PropTypes.string,
  required: PropTypes.bool,
  type: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  autoComplete: PropTypes.string,
  disabled: PropTypes.bool,
};
