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
    description: string
    enum: $TSFixMe[]
    format: string
    items: JsonSchema
    properties: Record<string, JsonSchema>
    type: string | string[] | JsonSchema[]
  } & Record<CompoundCondition, JsonSchema[]>
>

export const isSchemaArray = (optSchema?: JsonSchema) => optSchema?.type === 'array'

export const isSchemaObject = (optSchema?: JsonSchema) => optSchema?.type === 'object'

const isSchemaString = (optSchema?: JsonSchema) => optSchema?.type === 'string'

const isSchemaNumber = (optSchema?: JsonSchema) => optSchema?.type === 'number'

const isSchemaInteger = (optSchema?: JsonSchema) => optSchema?.type === 'integer'

export const isSchemaBoolean = (optSchema?: JsonSchema) => optSchema?.type === 'boolean'

const isSchemaNull = (optSchema?: JsonSchema) => optSchema?.type === 'null'

export const isSchemaEnum = (optSchema?: JsonSchema) => !!optSchema?.enum

export const isSchemaOneOf = (optSchema?: JsonSchema) => !!optSchema?.oneOf

export const isSchemaAnyOf = (optSchema?: JsonSchema) => !!optSchema?.anyOf

export const isSchemaAllOf = (optSchema?: JsonSchema) => !!optSchema?.allOf

const isSchemaConst = (optSchema?: JsonSchema) => !!optSchema?.const

function isSchemaCompound(optSchema?: JsonSchema) {
  if (!optSchema) return false
  return ['anyOf', 'oneOf', 'not', 'allOf'].some(
    (key) => optSchema[key as 'anyOf' | 'oneOf' | 'not' | 'allOf'],
  )
}

const isSchemaReference = (optSchema: JsonSchema) => !!optSchema?.$ref

export const isNestedType = R.either(isSchemaArray, isSchemaObject)

function compoundTypeToHumanString(
  optSchema: JsonSchema,
  condition: CompoundCondition,
  divider: string,
): string {
  if (!isSchemaCompound(optSchema)) return ''

  return optSchema[condition]!.map(schemaTypeToHumanString)
    .filter((v) => v !== 'undefined') // NOTE: sic, see default case of `schemaTypeToHumanString`
    .join(divider)
}

export function schemaTypeToHumanString(optSchema?: JsonSchema) {
  if (!optSchema) return ''
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
    [isSchemaOneOf, () => compoundTypeToHumanString(optSchema, 'oneOf', '|')],
    [isSchemaAllOf, () => compoundTypeToHumanString(optSchema, 'allOf', '&')],
    [isSchemaCompound, () => 'compound'],
    [isSchemaReference, () => '$ref'],
    [R.T, () => 'undefined'],
  ])(optSchema)
}

function doesTypeMatchCompoundSchema(
  value: any,
  condition: CompoundCondition,
  optSchema?: JsonSchema,
): boolean {
  if (!optSchema) return true

  if (!isSchemaCompound(optSchema)) return false

  return optSchema[condition]!.filter(R.has('type')).some((subSchema) =>
    doesTypeMatchSchema(value, subSchema),
  )
}

// Purpose is to find mismatch explicitly
// TODO: rename and redesign function to avoid "if no schema -> return true aka 'type matches schema'"
export function doesTypeMatchSchema(value: any, optSchema?: JsonSchema): boolean {
  if (!optSchema) return true
  return R.cond<JsonSchema, boolean>([
    [isSchemaEnum, () => R.includes(value, R.propOr([], 'enum', optSchema))],
    [
      (s) => Array.isArray(s?.type),
      () =>
        (optSchema.type as JsonSchema[]).some((subSchema) =>
          doesTypeMatchSchema(value, subSchema),
        ),
    ],
    [isSchemaAnyOf, () => doesTypeMatchCompoundSchema(value, 'anyOf', optSchema)],
    [isSchemaOneOf, () => doesTypeMatchCompoundSchema(value, 'oneOf', optSchema)],
    [isSchemaAllOf, () => doesTypeMatchCompoundSchema(value, 'allOf', optSchema)],
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

    return (obj: any): Ajv.ErrorObject[] => {
      validate(R.clone(obj))
      // TODO: add custom errors
      return validate.errors || []
    }
  } catch (e) {
    // TODO: add custom errors
    return () => (e instanceof Error ? [e] : []) as Error[]
  }
}

// TODO: make general purpose function like reduce,
//       do "prefill Value" at callback,
//       and use it for iterating Schema in JsonEditor/State
function scanSchemaAndPrefillValues(
  getValue: (s?: JsonSchema) => any,
  value: Record<string, any>,
  optSchema?: JsonSchema,
): Record<string, any> {
  if (!optSchema) return value

  if (!optSchema?.properties) return value

  return Object.keys(optSchema.properties).reduce((memo, key) => {
    const valueItem = value === undefined ? undefined : value[key]

    // don't touch user's primitive value
    if (valueItem && !R.is(Object, valueItem)) return memo

    const schemaItem = R.propOr({}, key, optSchema.properties) as JsonSchema

    if (schemaItem.properties)
      return R.assoc(
        key,
        scanSchemaAndPrefillValues(getValue, valueItem, schemaItem),
        memo,
      )

    if (schemaItem.items && Array.isArray(valueItem))
      return R.assoc(
        key,
        valueItem.map((v) => scanSchemaAndPrefillValues(getValue, v, schemaItem.items)),
        memo,
      )

    const preDefinedValue = getValue(schemaItem)
    if (preDefinedValue) return R.assoc(key, preDefinedValue, memo)

    return memo
  }, value)
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
  return (obj: any) => scanSchemaAndPrefillValues(getDefaultValue, obj, optSchema)
}
