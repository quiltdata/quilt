import Ajv, { SchemaObject, ErrorObject, Options } from 'ajv'
import addFormats from 'ajv-formats'
import * as dateFns from 'date-fns'
import * as R from 'ramda'

type CompoundCondition = 'anyOf' | 'oneOf' | 'not' | 'allOf'

// TODO: use more detailed `Ajv.JSONSchemaType` instead
export type JsonSchema = SchemaObject

export function isSchemaCompound(optSchema?: JsonSchema) {
  if (!optSchema) return false
  if (Array.isArray(optSchema)) return true
  return ['anyOf', 'oneOf', 'not', 'allOf'].some(
    (key) => optSchema[key as 'anyOf' | 'oneOf' | 'not' | 'allOf'],
  )
}

function hasTypeInCompoundSchema(
  typeCheck: (schema?: JsonSchema) => boolean,
  optSchema?: JsonSchema,
) {
  if (!isSchemaCompound(optSchema)) return false
  if (optSchema?.allOf) return optSchema.allOf.every(typeCheck)
  if (optSchema?.anyOf) return optSchema.anyOf.some(typeCheck)
  if (optSchema?.oneOf) {
    const checks = optSchema?.oneOf.map(typeCheck)
    // [true,false,false] => [1,0,0] => sum === 1
    return checks.reduce((memo: number, check: boolean) => memo + Number(check), 0) === 1
  }
  if (optSchema?.not) return !typeCheck(optSchema.not)
  if (Array.isArray(optSchema)) return optSchema.some(typeCheck)
}

export function findTypeInCompoundSchema(
  typeCheck: (schema?: JsonSchema) => boolean,
  optSchema?: JsonSchema,
) {
  if (!isSchemaCompound(optSchema)) return typeCheck(optSchema) ? optSchema : undefined
  if (optSchema?.allOf)
    return hasTypeInCompoundSchema(typeCheck, optSchema)
      ? optSchema.allOf.find(typeCheck)
      : undefined
  if (optSchema?.anyOf) return optSchema.anyOf.find(typeCheck)
  if (optSchema?.oneOf)
    return hasTypeInCompoundSchema(typeCheck, optSchema)
      ? optSchema?.oneOf.find(typeCheck)
      : undefined
  if (Array.isArray(optSchema)) return optSchema.find(typeCheck)
}

export function isSchemaArray(optSchema?: JsonSchema) {
  return optSchema?.type === 'array' || hasTypeInCompoundSchema(isSchemaArray, optSchema)
}

export function isSchemaObject(optSchema?: JsonSchema) {
  return (
    optSchema?.type === 'object' || hasTypeInCompoundSchema(isSchemaObject, optSchema)
  )
}

function isSchemaString(optSchema?: JsonSchema) {
  return (
    optSchema?.type === 'string' || hasTypeInCompoundSchema(isSchemaString, optSchema)
  )
}

function isSchemaNumber(optSchema?: JsonSchema) {
  return (
    optSchema?.type === 'number' || hasTypeInCompoundSchema(isSchemaNumber, optSchema)
  )
}

function isSchemaInteger(optSchema?: JsonSchema) {
  return (
    optSchema?.type === 'integer' || hasTypeInCompoundSchema(isSchemaInteger, optSchema)
  )
}

export function isSchemaBoolean(optSchema?: JsonSchema) {
  return (
    optSchema?.type === 'boolean' || hasTypeInCompoundSchema(isSchemaBoolean, optSchema)
  )
}

function isSchemaNull(optSchema?: JsonSchema) {
  return optSchema?.type === 'null' || hasTypeInCompoundSchema(isSchemaNull, optSchema)
}

export function isSchemaEnum(optSchema?: JsonSchema) {
  return !!optSchema?.enum || hasTypeInCompoundSchema(isSchemaEnum, optSchema)
}

export function isSchemaOneOf(optSchema?: JsonSchema) {
  return !!optSchema?.oneOf || hasTypeInCompoundSchema(isSchemaOneOf, optSchema)
}

export function isSchemaAnyOf(optSchema?: JsonSchema) {
  return !!optSchema?.anyOf || hasTypeInCompoundSchema(isSchemaAnyOf, optSchema)
}

export function isSchemaAllOf(optSchema?: JsonSchema) {
  return !!optSchema?.allOf || hasTypeInCompoundSchema(isSchemaAllOf, optSchema)
}

function isSchemaConst(optSchema?: JsonSchema) {
  return !!optSchema?.const || hasTypeInCompoundSchema(isSchemaConst, optSchema)
}

function isSchemaReference(optSchema?: JsonSchema) {
  return !!optSchema?.$ref || hasTypeInCompoundSchema(isSchemaReference, optSchema)
}

export function isNestedType(optSchema?: JsonSchema) {
  return (
    isSchemaArray(optSchema) ||
    isSchemaObject(optSchema) ||
    hasTypeInCompoundSchema(isNestedType, optSchema)
  )
}

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

  return optSchema[condition]!.filter((s: JsonSchema) => s.type || s.$ref).some(
    (subSchema: JsonSchema) => doesTypeMatchSchema(value, subSchema),
  )
}

// Purpose is to find mismatch explicitly
// TODO: rename and redesign function to avoid "if no schema -> return true aka 'type matches schema'"
export function doesTypeMatchSchema(value: any, optSchema?: JsonSchema): boolean {
  if (!optSchema) return true
  return R.cond<JsonSchema, boolean>([
    [
      isSchemaEnum,
      () => {
        const foundSchema = findTypeInCompoundSchema(isSchemaEnum, optSchema)
        const options = foundSchema?.enum || []
        // Note that value and enum items can be objects
        const includesEnum = R.includes(value)
        // TODO: use R.includes(value, options) without aux const
        //       ramda types incorectly set return type
        return includesEnum(options)
      },
    ],
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
