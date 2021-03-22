import Ajv from 'ajv'
import * as dateFns from 'date-fns'
import * as R from 'ramda'

export const isSchemaArray = (optSchema) => R.prop('type', optSchema) === 'array'

export const isSchemaObject = (optSchema) => R.prop('type', optSchema) === 'object'

const isSchemaString = (optSchema) => R.prop('type', optSchema) === 'string'

const isSchemaNumber = (optSchema) => R.prop('type', optSchema) === 'number'

const isSchemaInteger = (optSchema) => R.prop('type', optSchema) === 'integer'

export const isSchemaBoolean = (optSchema) => R.prop('type', optSchema) === 'boolean'

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

  const ajv = new Ajv({ useDefaults: true, schemaId: 'auto' })

  try {
    const validate = ajv.compile(schema)

    return (obj) => {
      validate(R.clone(obj))
      // TODO: add custom errors
      return validate.errors || []
    }
  } catch (e) {
    // TODO: add custom errors
    return () => [e]
  }
}

export function scan(optValue, optSchema) {
  if (!optSchema) return optValue

  if (!optSchema?.properties) return optValue

  const keys = Object.keys(optSchema.properties)
  return keys.reduce((memo, key) => {
    const valueItem = optValue === undefined ? undefined : optValue[key]

    // don't touch user's primitive value
    if (valueItem && !R.is(Object, valueItem)) return memo

    const schemaItem = optSchema.properties[key]

    if (schemaItem.default !== undefined) return R.assoc(key, schemaItem.default, memo)

    try {
      if (schemaItem.format === 'date' && schemaItem.dateformat)
        return R.assoc(key, dateFns.format(new Date(), schemaItem.dateformat), memo)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    }

    if (schemaItem.properties) return R.assoc(key, scan(valueItem, schemaItem), memo)

    if (schemaItem.items && Array.isArray(valueItem))
      return R.assoc(
        key,
        valueItem.map((v) => scan(v, schemaItem.items)),
        memo,
      )

    return memo
  }, optValue)
}

export function makeSchemaDefaultsSetter(optSchema) {
  return (obj) => scan(obj, optSchema)
}
