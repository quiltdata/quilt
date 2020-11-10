import * as R from 'ramda'
import isArray from 'lodash/isArray'
import isNumber from 'lodash/isNumber'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import isUndefined from 'lodash/isUndefined'

function isSchemaArray(optSchema) {
  return R.prop('type', optSchema) === 'array'
}

function isSchemaObject(optSchema) {
  return R.prop('type', optSchema) === 'object'
}

function isSchemaString(optSchema) {
  return R.prop('type', optSchema) === 'string' && !isSchemaEnum(optSchema)
}

function isSchemaNumber(optSchema) {
  return R.prop('type', optSchema) === 'number'
}

function isSchemaBoolean(optSchema) {
  return R.prop('type', optSchema) === 'boolean'
}

function isSchemaNull(optSchema) {
  return R.prop('type', optSchema) === 'null'
}

export function isSchemaEnum(optSchema) {
  return !!R.prop('enum', optSchema)
}

function isSchemaConst(optSchema) {
  return !!R.prop('const', optSchema)
}

function isSchemaCompound(optSchema) {
  if (!optSchema) return false
  return ['anyOf', 'oneOf', 'not', 'allOf'].some((key) => optSchema[key])
}

function isSchemaReference(optSchema) {
  return !!R.prop('$ref', optSchema)
}

export const isNestedType = R.either(isSchemaArray, isSchemaObject)

export function schemaTypeToHumanString(optSchema) {
  return R.cond([
    [isSchemaEnum, () => 'enum'],
    [isSchemaConst, () => 'const'],
    [isSchemaBoolean, () => 'boolean'],
    [isSchemaNull, () => 'null'],
    // NOTE: enum and const can be string too,
    //       that's why they are first
    [R.prop('type'), () => optSchema.type],
    [isSchemaCompound, () => 'compound'],
    [isSchemaReference, () => '$ref'],
    [R.T, () => 'undefined'],
  ])(optSchema)
}

export function doesTypeMatchSchema(value, optSchema) {
  return R.cond([
    [isArray, () => isSchemaArray(optSchema)],
    [isObject, () => isSchemaObject(optSchema)],
    [
      isString,
      () => {
        if (isSchemaString(optSchema)) return true

        // TODO: enum can be consisted from any types
        return R.propOr([], 'enum', optSchema).includes(value)
      },
    ],
    [isNumber, () => isSchemaNumber(optSchema)],
    [R.T, isUndefined],
  ])(value)
}
