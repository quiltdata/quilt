import {
  iterateJsonDict,
  iterateSchema,
  mergeSchemaAndObjRootKeys,
  validateOnSchema,
} from './State'

import * as booleansNulls from './mocks/booleans-nulls'
import * as compound from './mocks/compound'
import * as deeplyNestedArray from './mocks/deeply-nested-array'
import * as deeplyNestedObject from './mocks/deeply-nested-object'
import * as incorrect from './mocks/incorrect'
import * as regular from './mocks/regular'

describe('components/JsonEditor/State', () => {
  describe('Root keys for JSON editor', () => {
    it('should contain keys of a given object', () => {
      const rootKeys = mergeSchemaAndObjRootKeys({}, { a: 1, b: 2, c: 3 })
      expect(rootKeys).toEqual(['a', 'b', 'c'])
    })

    it('should contain keys of Schema', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(booleansNulls.schema, {})
      expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool'])
    })

    it('should contain both keys of object and Schema, Schema first', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(booleansNulls.schema, { 1: 1, z: 'z' })
      expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool', '1', 'z'])
    })

    it('should contain both keys of object and Schema, required first', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, { 1: 1, z: 'z' })
      expect(rootKeys).toEqual([
        'a',
        'b',
        'optList',
        'optEnum',
        'enumObjects',
        'enumArrays',
        'enumArraysAndObjects',
        '1',
        'z',
      ])
    })
  })

  describe('JSON dict', () => {
    it('should be empty for no Schema', () => {
      const jsonDict = iterateSchema({}, { current: 0 }, [], {})
      expect(jsonDict).toEqual({})
    })

    it('should contain values for a flat Schema', () => {
      const jsonDict = iterateSchema(booleansNulls.schema, { current: 0 }, [], {})
      expect(jsonDict).toEqual(booleansNulls.jsonDict)
    })

    it('should contain values for every nesting level of Schema, object', () => {
      const jsonDict = iterateSchema(deeplyNestedObject.schema, { current: 0 }, [], {})
      expect(jsonDict).toEqual(deeplyNestedObject.jsonDict)
    })

    it("shouldn't contain values for every nesting level of Schema, array", () => {
      const jsonDict = iterateSchema(deeplyNestedArray.schema, { current: 0 }, [], {})
      expect(jsonDict).toEqual(deeplyNestedArray.jsonDict)
    })
  })

  describe('UI columns', () => {
    it('should have one empty column for an empty object', () => {
      const jsonDict = iterateSchema({}, { current: 0 }, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, {})
      const columns = iterateJsonDict(jsonDict, {}, [], rootKeys)
      expect(columns).toEqual([{ parent: {}, items: [] }])
    })

    it('should have one column with Schema keys for an empty object', () => {
      const jsonDict = iterateSchema(regular.schema, { current: 0 }, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, {})
      const columns = iterateJsonDict(jsonDict, {}, [], rootKeys)
      expect(columns).toEqual(regular.columnsSchemaOnly)
    })

    it('should have one column with Schema keys for a flat object', () => {
      const jsonDict = iterateSchema(regular.schema, { current: 0 }, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, regular.object1)
      const columns = iterateJsonDict(jsonDict, regular.object1, [], rootKeys)
      expect(columns).toEqual(regular.columnsSchemaAndObject1)
    })

    it('should have three columns for empty object and path', () => {
      const jsonDict = iterateSchema(deeplyNestedObject.schema, { current: 0 }, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(deeplyNestedObject.schema, {})
      const columns = iterateJsonDict(
        jsonDict,
        {},
        deeplyNestedObject.fieldPathNested,
        rootKeys,
      )
      expect(columns).toEqual(deeplyNestedObject.columnsNested)
    })

    it('should have three columns for given object and path', () => {
      const jsonDict = iterateSchema({}, { current: 0 }, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, deeplyNestedObject.object1)
      const columns = iterateJsonDict(
        jsonDict,
        deeplyNestedObject.object1,
        deeplyNestedObject.fieldPath1,
        rootKeys,
      )
      expect(columns).toEqual(deeplyNestedObject.columns1)
    })
  })

  describe('Schema', () => {
    it('should validate required keyword', () => {
      const validate = validateOnSchema(regular.schema)

      const obj = { optList: [{ id: 1, name: 'Name' }], optEnum: 'one' }
      const errors = validate(obj)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        keyword: 'required',
        params: { missingProperty: 'a' },
      })
    })

    it('should validate enum type', () => {
      const validate = validateOnSchema(regular.schema)

      const invalid = { a: 123, b: 'value', optEnum: 'value' }
      const errors = validate(invalid)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({ dataPath: '.optEnum', keyword: 'enum' })

      const valid = { a: 123, b: 'value', optEnum: 'one' }
      expect(validate(valid)).toHaveLength(0)
    })

    it('should validate array type', () => {
      const validate = validateOnSchema(deeplyNestedArray.schema)

      const invalid1 = { longNestedList: [{}] }
      const errors1 = validate(invalid1)
      expect(errors1).toHaveLength(1)
      expect(errors1[0]).toMatchObject({
        dataPath: '.longNestedList[0]',
        keyword: 'type',
      })

      const invalid2 = { longNestedList: [[[[[[[[[['string']]]]]]]]]] }
      const errors2 = validate(invalid2)
      expect(errors2).toHaveLength(1)
      expect(errors2[0]).toMatchObject({
        dataPath: '.longNestedList[0][0][0][0][0][0][0][0][0][0]',
        keyword: 'type',
      })

      const invalid3 = { longNestedList: [[[[[[[[[[1, 2, 3, 4, 'string']]]]]]]]]] }
      const errors3 = validate(invalid3)
      expect(errors3).toHaveLength(1)
      expect(errors3[0]).toMatchObject({
        dataPath: '.longNestedList[0][0][0][0][0][0][0][0][0][4]',
        keyword: 'type',
      })

      const valid = { longNestedList: [[[[[[[[[[1, 2.5, 3, 10e100, Infinity]]]]]]]]]] }
      expect(validate(valid)).toHaveLength(0)
    })

    it('should validate number and string types', () => {
      const validate = validateOnSchema(regular.schema)

      const invalidNumber = { a: 'b', b: 'b' }
      const errorsNumber = validate(invalidNumber)
      expect(errorsNumber).toHaveLength(1)
      expect(errorsNumber[0]).toMatchObject({ dataPath: '.a', keyword: 'type' })

      const invalidString = { a: 123, b: 123 }
      const errorsString = validate(invalidString)
      expect(errorsString).toHaveLength(1)
      expect(errorsString[0]).toMatchObject({ dataPath: '.b', keyword: 'type' })

      const valid = { a: 123, b: 'b' }
      expect(validate(valid)).toHaveLength(0)
    })

    it('should validate boolean and null types', () => {
      const validate = validateOnSchema(booleansNulls.schema)

      const invalidNull = { nullValue: 123 }
      const errorsNull = validate(invalidNull)
      expect(errorsNull).toHaveLength(1)
      expect(errorsNull[0]).toMatchObject({ dataPath: '.nullValue', keyword: 'type' })

      const invalidBool = { boolValue: 0 }
      const errorsBool = validate(invalidBool)
      expect(errorsBool).toHaveLength(1)
      expect(errorsBool[0]).toMatchObject({ dataPath: '.boolValue', keyword: 'type' })

      const invalidEnum = { enumBool: null }
      const errorsEnum = validate(invalidEnum)
      expect(errorsEnum).toHaveLength(1)
      expect(errorsEnum[0]).toMatchObject({ dataPath: '.enumBool', keyword: 'type' })

      const valid = {
        nullValue: null,
        boolValue: true,
        enumBool: false,
        extraKey: 'extra value',
      }
      expect(validate(valid)).toHaveLength(0)
    })

    it('should validate compound types', () => {
      const validate = validateOnSchema(compound.schemaAnyOf)

      const emptyObject = {}
      expect(validate(emptyObject)).toEqual([])

      const invalidAnyOf = { numOrString: [] }
      const errorsAnyOf = validate(invalidAnyOf)
      expect(errorsAnyOf).toHaveLength(3)
      expect(errorsAnyOf[0]).toMatchObject({ dataPath: '.numOrString', keyword: 'type' })
      expect(errorsAnyOf[1]).toMatchObject({ dataPath: '.numOrString', keyword: 'type' })
      expect(errorsAnyOf[2]).toMatchObject({ dataPath: '.numOrString', keyword: 'anyOf' })

      const invalidOneOf = { intOrNonNumberOrLess3: 4.5 }
      const errorsOneOf = validate(invalidOneOf)
      expect(errorsOneOf).toHaveLength(3)
      expect(errorsOneOf[0]).toMatchObject({
        dataPath: '.intOrNonNumberOrLess3',
        keyword: 'maximum',
      })
      expect(errorsOneOf[1]).toMatchObject({
        dataPath: '.intOrNonNumberOrLess3',
        keyword: 'type',
      })
      expect(errorsOneOf[2]).toMatchObject({
        dataPath: '.intOrNonNumberOrLess3',
        keyword: 'oneOf',
      })

      const invalidAllOf1 = { intLessThan3: 'a' }
      const errorsAllOf1 = validate(invalidAllOf1)
      expect(errorsAllOf1).toHaveLength(1)
      expect(errorsAllOf1[0]).toMatchObject({
        dataPath: '.intLessThan3',
        keyword: 'type',
      })

      const invalidAllOf2 = { intLessThan3: 3.5 }
      const errorsAllOf2 = validate(invalidAllOf2)
      expect(errorsAllOf2).toHaveLength(1)
      expect(errorsAllOf2[0]).toMatchObject({
        dataPath: '.intLessThan3',
        keyword: 'maximum',
      })

      const validObj = { numOrString: 3.5, intOrNonNumberOrLess3: 2.5, intLessThan3: 2 }
      const errors = validate(validObj)
      expect(errors).toHaveLength(0)
    })

    it('should validate types as arrays', () => {
      const validate = validateOnSchema(compound.schemaTypeArray)

      const invalidProperty = { strOrNum: [], strOrNumList: [{}, null, true] }
      const errorsProperty = validate(invalidProperty)
      expect(errorsProperty).toHaveLength(1)
      expect(errorsProperty[0]).toMatchObject({ dataPath: '.strOrNum', keyword: 'type' })

      const invalidItem1 = { strOrNum: 123, strOrNumList: [{}, null, true] }
      const errorsItem1 = validate(invalidItem1)
      expect(errorsItem1).toHaveLength(1)
      expect(errorsItem1[0]).toMatchObject({
        dataPath: '.strOrNumList[0]',
        keyword: 'type',
      })

      const invalidItem2 = { strOrNum: 123, strOrNumList: [123, null, true] }
      const errorsItem2 = validate(invalidItem2)
      expect(errorsItem2).toHaveLength(1)
      expect(errorsItem2[0]).toMatchObject({
        dataPath: '.strOrNumList[1]',
        keyword: 'type',
      })

      const validString = { strOrNum: 'string', strOrNumList: ['one', 2, 2.5, 0] }
      expect(validate(validString)).toHaveLength(0)

      const validNumber = { strOrNum: 123, strOrNumList: [1, 2, 3] }
      expect(validate(validNumber)).toHaveLength(0)
    })

    it('should throw an error when schema is incorrect', () => {
      const validate = validateOnSchema(incorrect.schema)
      const errors = validate({})

      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(Error)
      expect(errors[0].message).toMatch(/schema is invalid/)
    })
  })
})
