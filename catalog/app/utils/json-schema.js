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
  return R.prop('type', optSchema) === 'string'
}

function isSchemaNumber(optSchema) {
  return R.prop('type', optSchema) === 'number'
}

function isSchemaBoolean(optSchema) {
  return R.prop('type', optSchema) === 'boolean'
}

export function isSchemaEnum(optSchema) {
  return Boolean(R.prop('enum', optSchema))
}

function isSchemaConst(optSchema) {
  return Boolean(R.prop('const', optSchema))
}

function isSchemaCompound(optSchema) {
  if (!optSchema) return false
  return ['anyOf', 'oneOf', 'not', 'allOf'].some((key) => optSchema[key])
}

function isSchemaReference(optSchema) {
  return Boolean(R.prop('$ref', optSchema))
}

export function isNestedType(optSchema) {
  return isSchemaArray(optSchema) || isSchemaObject(optSchema)
}

export function schemaTypetoHumanString(optSchema) {
  return R.cond([
    [isSchemaEnum, () => 'enum'],
    [isSchemaConst, () => 'const'],
    [isSchemaBoolean, () => 'bool'],
    // NOTE: enum and const can be string too,
    //       that's why they are first
    [R.prop('type'), () => R.take(3, optSchema.type)],
    [isSchemaCompound, () => 'comp'],
    [isSchemaReference, () => '$ref'],
    [R.T, () => 'none'],
  ])(optSchema)
}

export function doesTypeMatchToSchema(value, optSchema) {
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
