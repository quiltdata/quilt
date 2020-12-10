import Ajv from 'ajv'
import * as R from 'ramda'

const isSchemaArray = (optSchema) => R.prop('type', optSchema) === 'array'

const isSchemaObject = (optSchema) => R.prop('type', optSchema) === 'object'

const isSchemaString = (optSchema) => R.prop('type', optSchema) === 'string'

const isSchemaNumber = (optSchema) => R.prop('type', optSchema) === 'number'

const isSchemaInteger = (optSchema) => R.prop('type', optSchema) === 'integer'

const isSchemaBoolean = (optSchema) => R.prop('type', optSchema) === 'boolean'

const isSchemaNull = (optSchema) => R.prop('type', optSchema) === 'null'

export const isSchemaEnum = (optSchema) => !!R.prop('enum', optSchema)

export const isSchemaOneOf = (optSchema) => !!R.prop('oneOf', optSchema)

export const isSchemaAnyOf = (optSchema) => !!R.prop('anyOf', optSchema)

export const isSchemaAllOf = (optSchema) => !!R.prop('allOf', optSchema)

const isSchemaConst = (optSchema) => !!R.prop('const', optSchema)

function isSchemaCompound(optSchema) {
  if (!optSchema) return false
  return ['anyOf', 'oneOf', 'not', 'allOf'].some((key) => optSchema[key])
}

const isSchemaReference = (optSchema) => !!R.prop('$ref', optSchema)

export const isNestedType = R.either(isSchemaArray, isSchemaObject)

function compoundTypeToHumanString(optSchema, condition, divider) {
  if (!Array.isArray(R.prop(condition, optSchema))) return ''

  return optSchema[condition]
    .map(schemaTypeToHumanString)
    .filter((v) => v !== 'undefined') // NOTE: sic, see default case of `schemaTypeToHumanString`
    .join(divider)
}

export function schemaTypeToHumanString(optSchema) {
  return R.cond([
    [isSchemaEnum, () => 'enum'],
    [isSchemaConst, () => 'const'],
    [isSchemaBoolean, () => 'boolean'],
    [isSchemaNull, () => 'null'],
    // NOTE: enum and const can be string too,
    //       that's why they are first
    [
      R.prop('type'),
      () => (Array.isArray(optSchema.type) ? optSchema.type.join('|') : optSchema.type),
    ],
    [isSchemaAnyOf, () => compoundTypeToHumanString(optSchema, 'anyOf', '|')],
    [isSchemaOneOf, () => compoundTypeToHumanString(optSchema, 'oneOf', '&')],
    [isSchemaAllOf, () => compoundTypeToHumanString(optSchema, 'allOf', '+')],
    [isSchemaCompound, () => 'compound'],
    [isSchemaReference, () => '$ref'],
    [R.T, () => 'undefined'],
  ])(optSchema)
}

function doesTypeMatchCompoundSchema(value, optSchema, condition) {
  if (!Array.isArray(R.prop(condition, optSchema))) return false

  return optSchema[condition]
    .filter(R.has('type'))
    .some((subSchema) => doesTypeMatchSchema(value, subSchema))
}

export function doesTypeMatchSchema(value, optSchema) {
  return R.cond([
    [isSchemaEnum, () => R.includes(value, R.propOr([], 'enum', optSchema))],
    [
      (s) => Array.isArray(R.prop('type', s)),
      () =>
        optSchema.type.some((subSchema) =>
          doesTypeMatchSchema(value, { type: subSchema }),
        ),
    ],
    [isSchemaAnyOf, () => doesTypeMatchCompoundSchema(value, optSchema, 'anyOf')],
    [isSchemaOneOf, () => doesTypeMatchCompoundSchema(value, optSchema, 'oneOf')],
    [isSchemaAllOf, () => doesTypeMatchCompoundSchema(value, optSchema, 'allOf')],
    [isSchemaArray, () => Array.isArray(value)],
    [isSchemaObject, () => R.is(Object, value)],
    [isSchemaString, () => R.is(String, value)],
    [isSchemaInteger, () => Number.isInteger(value)],
    [isSchemaNumber, () => R.is(Number, value)],
    [isSchemaNull, () => R.equals(null, value)],
    [isSchemaBoolean, () => R.is(Boolean, value)],
    [R.T, R.T], // It's not a user's fault that we can't handle the type
  ])(optSchema)
}

export const EMPTY_SCHEMA = {}

export function makeSchemaValidator(optSchema) {
  const schema = optSchema || EMPTY_SCHEMA

  const ajv = new Ajv({ schemaId: 'auto' })

  try {
    const validate = ajv.compile(schema)

    return (obj) => {
      validate(obj)
      // TODO: add custom errors
      return validate.errors || []
    }
  } catch (e) {
    // TODO: add custom errors
    return () => [e]
  }
}
