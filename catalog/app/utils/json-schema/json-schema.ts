import Ajv from 'ajv'
import * as dateFns from 'date-fns'
import * as R from 'ramda'

type CompoundCondition = 'anyOf' | 'oneOf' | 'not' | 'allOf'

export type JsonSchema = Partial<
  {
    $ref: string
    const: string
    dateformat: string
    default: any
    enum: $TSFixMe[]
    format: string
    items: JsonSchema
    properties: Record<string, JsonSchema>
    type: string | string[] | JsonSchema[]
  } & Record<CompoundCondition, JsonSchema[]>
>

export const isSchemaArray = (optSchema: JsonSchema) =>
  R.prop('type', optSchema) === 'array'

export const isSchemaObject = (optSchema: JsonSchema) =>
  R.prop('type', optSchema) === 'object'

const isSchemaString = (optSchema: JsonSchema) => R.prop('type', optSchema) === 'string'

const isSchemaNumber = (optSchema: JsonSchema) => R.prop('type', optSchema) === 'number'

const isSchemaInteger = (optSchema: JsonSchema) => R.prop('type', optSchema) === 'integer'

export const isSchemaBoolean = (optSchema: JsonSchema) =>
  R.prop('type', optSchema) === 'boolean'

const isSchemaNull = (optSchema: JsonSchema) => R.prop('type', optSchema) === 'null'

export const isSchemaEnum = (optSchema: JsonSchema) => !!R.prop('enum', optSchema)

export const isSchemaOneOf = (optSchema: JsonSchema) => !!R.prop('oneOf', optSchema)

export const isSchemaAnyOf = (optSchema: JsonSchema) => !!R.prop('anyOf', optSchema)

export const isSchemaAllOf = (optSchema: JsonSchema) => !!R.prop('allOf', optSchema)

const isSchemaConst = (optSchema: JsonSchema) => !!R.prop('const', optSchema)

function isSchemaCompound(optSchema: JsonSchema) {
  if (!optSchema) return false
  return ['anyOf', 'oneOf', 'not', 'allOf'].some(
    (key) => optSchema[key as 'anyOf' | 'oneOf' | 'not' | 'allOf'],
  )
}

const isSchemaReference = (optSchema: JsonSchema) => !!R.prop('$ref', optSchema)

export const isNestedType = R.either(isSchemaArray, isSchemaObject)

function compoundTypeToHumanString(
  optSchema: JsonSchema,
  condition: CompoundCondition,
  divider: string,
): string {
  if (!Array.isArray(R.prop(condition, optSchema))) return ''

  return (optSchema[condition] as JsonSchema[])
    .map(schemaTypeToHumanString)
    .filter((v) => v !== 'undefined') // NOTE: sic, see default case of `schemaTypeToHumanString`
    .join(divider)
}

export function schemaTypeToHumanString(optSchema: JsonSchema) {
  return R.cond<JsonSchema, string>([
    [isSchemaEnum, () => 'enum'],
    [isSchemaConst, () => 'const'],
    [isSchemaBoolean, () => 'boolean'],
    [isSchemaNull, () => 'null'],
    // NOTE: enum and const can be string too,
    //       that's why they are first
    [
      R.propOr('', 'type'),
      () =>
        Array.isArray(optSchema.type)
          ? optSchema.type.join('|')
          : (optSchema.type as string),
    ],
    [isSchemaAnyOf, () => compoundTypeToHumanString(optSchema, 'anyOf', '|')],
    [isSchemaOneOf, () => compoundTypeToHumanString(optSchema, 'oneOf', '&')],
    [isSchemaAllOf, () => compoundTypeToHumanString(optSchema, 'allOf', '+')],
    [isSchemaCompound, () => 'compound'],
    [isSchemaReference, () => '$ref'],
    [R.T, () => 'undefined'],
  ])(optSchema)
}

function doesTypeMatchCompoundSchema(
  value: any,
  optSchema: JsonSchema,
  condition: CompoundCondition,
): boolean {
  if (!Array.isArray(R.prop(condition, optSchema))) return false

  return (optSchema[condition] as JsonSchema[])
    .filter(R.has('type'))
    .some((subSchema) => doesTypeMatchSchema(value, subSchema))
}

export function doesTypeMatchSchema(value: any, optSchema: JsonSchema): boolean {
  return R.cond<JsonSchema, boolean>([
    [isSchemaEnum, () => R.includes(value, R.propOr([], 'enum', optSchema))],
    [
      (s) => Array.isArray(R.prop('type', s)),
      () =>
        (optSchema.type as JsonSchema[]).some((subSchema) =>
          doesTypeMatchSchema(value, subSchema),
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

export function makeSchemaValidator(optSchema?: JsonSchema) {
  const schema = optSchema || EMPTY_SCHEMA

  const ajv = new Ajv({ useDefaults: true, schemaId: 'auto' })

  try {
    const validate = ajv.compile(schema)

    return (obj: any) => {
      validate(R.clone(obj))
      // TODO: add custom errors
      return validate.errors || []
    }
  } catch (e) {
    // TODO: add custom errors
    return () => [e]
  }
}

export function scan(
  callback: (v?: any, s?: JsonSchema) => any,
  optValue: Record<string, any>,
  optSchema?: JsonSchema,
): Record<string, any> {
  if (!optSchema) return optValue

  if (!optSchema?.properties) return optValue

  return Object.keys(optSchema.properties).reduce((memo, key) => {
    const valueItem = optValue === undefined ? undefined : optValue[key]

    // don't touch user's primitive value
    if (valueItem && !R.is(Object, valueItem)) return memo

    const schemaItem = R.propOr({}, key, optSchema.properties) as JsonSchema

    if (schemaItem.properties)
      return R.assoc(key, scan(callback, valueItem, schemaItem), memo)

    if (schemaItem.items && Array.isArray(valueItem))
      return R.assoc(
        key,
        valueItem.map((v) => scan(callback, v, schemaItem.items)),
        memo,
      )

    const preDefinedValue = callback(schemaItem)
    if (preDefinedValue) return R.assoc(key, preDefinedValue, memo)

    return memo
  }, optValue)
}

export function getDefaultValue(optSchema?: JsonSchema): any {
  if (!optSchema) return undefined

  if (optSchema.default !== undefined) return optSchema.default

  try {
    if (optSchema.format === 'date' && optSchema.dateformat)
      return dateFns.format(new Date(), optSchema.dateformat)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }

  return undefined
}

export function makeSchemaDefaultsSetter(optSchema?: JsonSchema) {
  return (obj: any) => scan(getDefaultValue, obj, optSchema)
}
