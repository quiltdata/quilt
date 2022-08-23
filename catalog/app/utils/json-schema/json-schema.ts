import Ajv, { SchemaObject, ErrorObject, Options } from 'ajv'
import addFormats from 'ajv-formats'
import * as dateFns from 'date-fns'
import * as R from 'ramda'

type CompoundCondition = 'anyOf' | 'oneOf' | 'not' | 'allOf'

// TODO: use more detailed `Ajv.JSONSchemaType` instead
export type JsonSchema = SchemaObject

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
    .filter((v: string) => v !== 'undefined') // NOTE: sic, see default case of `schemaTypeToHumanString`
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

  return optSchema[condition]!.filter(R.has('type')).some((subSchema: JsonSchema) =>
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

export const EMPTY_SCHEMA: JsonSchema = {}

export function makeSchemaValidator(
  optSchema?: JsonSchema,
  optSchemas?: JsonSchema[],
  ajvOptions?: Options,
): (obj?: any) => (Error | ErrorObject)[] {
  let mainSchema = R.clone(optSchema || EMPTY_SCHEMA)
  if (!mainSchema.$id) {
    // Make further code more universal by using one format: `id` → `$id`
    if (mainSchema.id) {
      mainSchema = R.pipe(R.assoc('$id', mainSchema.id), R.dissoc('id'))(mainSchema)
    } else {
      mainSchema = R.assoc('$id', 'main_schema', mainSchema)
    }
  }
  const schemas = optSchemas ? [mainSchema, ...optSchemas] : [mainSchema]

  const { $id } = schemas[0]
  const options: Options = {
    allErrors: true,
    schemaId: '$id',
    schemas,
    useDefaults: true,
    ...ajvOptions,
  }

  try {
    const ajv = new Ajv(options)
    addFormats(ajv, ['date', 'regex', 'uri'])
    ajv.addKeyword('dateformat')

    // TODO: show warning if $schema !== '…draft-07…'
    // TODO: fail early, return Error instead of callback
    if (!$id) return () => [new Error('$id is not provided')]

    return (obj: any): (Error | ErrorObject)[] => {
      try {
        ajv.validate($id, R.clone(obj))
      } catch (e) {
        return e instanceof Error ? [e] : []
      }
      // TODO: add custom errors
      return ajv.errors || []
    }
  } catch (e) {
    // TODO: fail early if Ajv options are incorrect, return Error instead of callback
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
