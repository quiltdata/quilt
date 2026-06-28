import memoize from 'lodash/memoize'
import * as R from 'ramda'

import * as s3paths from './s3paths'

// The whole-form model passed to a validator: an Immutable Map (has .get) or a
// plain object. Used internally by matchesField.
type AllValues = { get?: (field: string) => unknown } & Record<string, unknown>

// `allValues`/`props` mirror final-form's FieldValidator args, so the public
// signature stays loosely typed for assignability with FF.FieldValidator.
type TestFunction = (value: any, allValues?: any, props?: any) => boolean

/**
 * Validation result:
 * undefined if the value is valid,
 * a string representing the validation error otherwise.
 */
type ValidationResult = string | undefined

/**
 * Validator function to use with final-form.
 */
type Validator = (value: any, allValues?: any, props?: any) => ValidationResult

/**
 * Create a validator using given error and test function.
 * Validation doesn't fire if the value is falsy.
 * The function is memoized to avoid unnecessary rerenders.
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
  (error: string, test: TestFunction): Validator =>
    (v, vs, props) =>
      // only test truthy values
      v && !test(v, vs, props) ? error : undefined,
)

/**
 * Create a test function that checks if the value matches the given RegExp.
 */
export const matches =
  (re: RegExp): TestFunction =>
  (str) =>
    re.test(str)

/**
 * Create a test function that checks if the value matches the other field's
 * value. Test passes if the other field's value is empty (falsy).
 */
export const matchesField =
  (field: string): TestFunction =>
  (v, vs) => {
    const all = vs as AllValues
    const other = typeof all.get === 'function' ? all.get(field) : all[field]
    return !other || v === other
  }

/**
 * Validate that the value is present (truthy). Error string: 'required'.
 */
export const required: Validator = (v) => (v ? undefined : 'required')

/**
 * Validate that the value is a non-empty object or array.  Error string: 'nonEmpty'.
 */
export const nonEmpty: Validator = (v) => (v && !R.isEmpty(v) ? undefined : 'nonEmpty')

/**
 * Validate that the string represents a valid integer. Error string: 'integer'.
 */
export const integer: Validator = (v) =>
  !v || Number.isInteger(Number(v)) ? undefined : 'integer'

/**
 * Validate that the string is a valid JSON. Error string: 'json'.
 */
export const json: Validator = (v) => {
  if (!v) return undefined
  try {
    JSON.parse(v)
    return undefined
  } catch (e) {
    return 'json'
  }
}

export const hexColor: Validator = (v) => {
  if (!v) return undefined
  return matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)(v) ? undefined : 'hex'
}

/**
 * Validate that the string is a URL that can plausibly resolve to a logo
 * image. Accepts http(s) URLs and `s3://bucket/key` URLs; rejects URLs
 * without a hostname (e.g. `s3://`) and S3 URLs without a key
 * (e.g. `s3://bucket`).
 */
export const logoUrl: Validator = (v) => {
  if (!v) return undefined
  try {
    if (!new window.URL(v).hostname) return 'logoUrl'
    if (s3paths.isS3Url(v) && !s3paths.parseS3Url(v).key) return 'logoUrl'
  } catch (e) {
    return 'logoUrl'
  }
  return undefined
}

export const file: Validator = (v) => {
  if (!v) return undefined
  return v instanceof File ? undefined : 'file'
}

/**
 * Validate that the string represents a valid JSON object. Error string: 'jsonObject'.
 */
export const jsonObject: Validator = (v) => {
  if (!v) return undefined
  try {
    const parsed = JSON.parse(v)
    return R.is(Object, parsed) ? undefined : 'jsonObject'
  } catch (e) {
    return 'jsonObject'
  }
}

export const composeOr =
  (...validators: Validator[]): Validator =>
  (v) => {
    let error: ValidationResult
    // check if any of validators returns undefined
    validators.some((validator) => {
      error = validator(v)
      return !error
    })
    return error
  }

export const composeAnd =
  (...validators: Validator[]): Validator =>
  (v) => {
    let error: ValidationResult
    // check if all validators returns undefined
    validators.every((validator) => {
      error = validator(v)
      return !error
    })
    return error
  }

export const composeAsync =
  (...validators: ((...args: any[]) => ValidationResult | Promise<ValidationResult>)[]) =>
  (...args: any[]): Promise<ValidationResult> =>
    validators.reduce(
      (error, next) => Promise.resolve(error).then((e) => e || next(...args)),
      undefined as ValidationResult | Promise<ValidationResult>,
    ) as Promise<ValidationResult>
