import memoize from 'lodash/memoize';

/**
 * @typedef {function} TestFunction
 *
 * @param {any} value
 *
 * @param {Immutable.Map} allValues
 *
 * @param {Object} props
 *
 * @returns {boolean}
 *   true if value is valid, false if invalid.
 */

/**
 * Validation result:
 * undefined if the value is valid,
 * a string representing the validation error otherwise.
 *
 * @typedef {?string} ValidationResult
 */

/**
 * Validator function to use with redux-form.
 *
 * @typedef {function} Validator
 *
 * @param {any} value
 *
 * @param {Immutable.Map} allValues
 *
 * @param {Object} props
 *
 * @returns {ValidationResult}
 */

/**
 * Create a validator using given error and test function.
 * Validation doesn't fire if the value is falsy.
 * The function is memoized to avoid unnecessary rerenders.
 *
 * @name validate
 *
 * @param {string} error
 *   Return this string if the test result is falsy.
 *
 * @param {TestFunction} test
 *
 * @returns {Validator}
 *
 * @example
 * <Field
 *   validate={[
 *     validate('strong', minlength(8)),
 *     validate('check', matchesField('password')),
 *   ]}
 *   ...
 * />
 */
export default memoize((error, test) => (v, vs, props) =>
  // only test truthy values
  v && !test(v, vs, props) ? error : undefined);

/**
 * Create a test function that checks if the value matches the given RegExp.
 *
 * @param {RegExp} re
 *
 * @returns {TestFunction}
 */
export const matches = (re) => (str) => re.test(str);

/**
 * Create a test function that checks if the value matches the other field's
 * value. Test passes if the other field's value is empty (falsy).
 *
 * @param {string} field
 *
 * @returns {TestFunction}
 */
export const matchesField = (field) => (v, vs) => {
  const other = vs.get(field);
  return !other || v === other;
};

/**
 * Validate that the value is present (truthy). Error string: 'required'.
 *
 * @type {Validator}
 */
export const required = (v) => v ? undefined : 'required';
