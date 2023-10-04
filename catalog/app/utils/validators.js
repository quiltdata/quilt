import memoize from 'lodash/memoize'
import * as R from 'ramda'

import * as s3paths from './s3paths'

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
 * Validator function to use with final-form.
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
export default memoize(
  (error, test) => (v, vs, props) =>
    // only test truthy values
    v && !test(v, vs, props) ? error : undefined,
)

/**
 * Create a test function that checks if the value matches the given RegExp.
 *
 * @param {RegExp} re
 *
 * @returns {TestFunction}
 */
export const matches = (re) => (str) => re.test(str)

/**
 * Create a test function that checks if the value matches the other field's
 * value. Test passes if the other field's value is empty (falsy).
 *
 * @param {string} field
 *
 * @returns {TestFunction}
 */
export const matchesField = (field) => (v, vs) => {
  const other = typeof vs.get === 'function' ? vs.get(field) : vs[field]
  return !other || v === other
}

/**
 * Validate that the value is present (truthy). Error string: 'required'.
 *
 * @type {Validator}
 */
export const required = (v) => (v ? undefined : 'required')

/**
 * Validate that the value is a non-empty object or array.  Error string: 'nonEmpty'.
 *
 * @type {Validator}
 */
export const nonEmpty = (v) => (v && !R.isEmpty(v) ? undefined : 'nonEmpty')

/**
 * Validate that the string represents a valid integer. Error string: 'integer'.
 *
 * @type {Validator}
 */
export const integer = (v) => (!v || Number.isInteger(Number(v)) ? undefined : 'integer')

/**
 * Validate that the string is a valid JSON. Error string: 'json'.
 *
 * @type {Validator}
 */
export const json = (v) => {
  if (!v) return undefined
  try {
    JSON.parse(v)
    return undefined
  } catch (e) {
    return 'json'
  }
}

export const hexColor = (v) => {
  if (!v) return undefined
  return matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)(v) ? undefined : 'hex'
}

export const url = (v) => {
  if (!v) return undefined
  try {
    // if v is not valid URL, then URL will throws
    new window.URL(v)
  } catch (e) {
    return 'url'
  }
}

export const s3Url = (v) => {
  if (!v) return undefined
  try {
    const { bucket, key } = s3paths.parseS3Url(v)
    if (!bucket || !key) return 's3Url'
  } catch (e) {
    return 's3Url'
  }
}

export const file = (v) => {
  if (!v) return undefined
  return v instanceof File ? undefined : 'file'
}

/**
 * Validate that the string represents a valid JSON object. Error string: 'jsonObject'.
 *
 * @type {Validator}
 */
export const jsonObject = (v) => {
  if (!v) return undefined
  try {
    const parsed = JSON.parse(v)
    return R.is(Object, parsed) ? undefined : 'jsonObject'
  } catch (e) {
    return 'jsonObject'
  }
}

export const composeOr =
  (...validators) =>
  (v) => {
    let error
    // check if any of validators returns undefined
    validators.some((validator) => {
      error = validator(v)
      return !error
    })
    return error
  }

export const composeAnd =
  (...validators) =>
  (v) => {
    let error
    // check if all validators returns undefined
    validators.every((validator) => {
      error = validator(v)
      return !error
    })
    return error
  }

export const composeAsync =
  (...validators) =>
  (...args) =>
    validators.reduce(
      (error, next) => Promise.resolve(error).then((e) => e || next(...args)),
      undefined,
    )
