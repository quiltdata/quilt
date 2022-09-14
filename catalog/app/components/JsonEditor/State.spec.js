import { iterateJsonDict, iterateSchema, mergeSchemaAndObjRootKeys } from './State'

import * as booleansNulls from './mocks/booleans-nulls'
import * as deeplyNestedArray from './mocks/deeply-nested-array'
import * as deeplyNestedObject from './mocks/deeply-nested-object'
import * as regular from './mocks/regular'
import * as sorted from './mocks/sorted'

describe('components/JsonEditor/State', () => {
  describe('mergeSchemaAndObjRootKeys', () => {
    it('should return root keys of a given object when no Schema', () => {
      const rootKeys = mergeSchemaAndObjRootKeys({}, { a: 1, b: 2, c: 3 })
      expect(rootKeys).toEqual(['a', 'b', 'c'])
    })

    it('should return root keys of Schema when no object', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(booleansNulls.schema, {})
      expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool'])
    })

    it('should return both keys of object and Schema, Schema first', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(booleansNulls.schema, { 1: 1, z: 'z' })
      expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool', '1', 'z'])
    })

    it('should return both keys of object and Schema, required first', () => {
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

  describe('iterateSchema', () => {
    it('should return empty object for no Schema', () => {
      const jsonDict = iterateSchema({}, { current: { counter: 0 } }, [], {})
      expect(jsonDict).toEqual({})
    })

    it('should return values for a flat Schema', () => {
      const jsonDict = iterateSchema(
        booleansNulls.schema,
        { current: { counter: 0 } },
        [],
        {},
      )
      expect(jsonDict).toEqual(booleansNulls.jsonDict)
    })

    it('should return values for every nesting level of Schema, when type is `object`', () => {
      const jsonDict = iterateSchema(
        deeplyNestedObject.schema,
        { current: { counter: 0 } },
        [],
        {},
      )
      expect(jsonDict).toEqual(deeplyNestedObject.jsonDict)
    })

    it('should return first value only for deep nesting level of Schema, when type is `array`', () => {
      const jsonDict = iterateSchema(
        deeplyNestedArray.schema,
        { current: { counter: 0 } },
        [],
        {},
      )
      expect(jsonDict).toEqual(deeplyNestedArray.jsonDict)
    })
  })

  describe('iterateJsonDict', () => {
    it('should return one empty state object, when input is an empty object', () => {
      const sortOrder = { current: { counter: 0, dict: {} } }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, {})
      const columns = iterateJsonDict(jsonDict, {}, [], rootKeys, sortOrder)
      expect(columns).toEqual([{ parent: {}, items: [] }])
    })

    it('should return one state object utilizing Schema keys, when input is an empty object', () => {
      const sortOrder = { current: { counter: 0, dict: {} } }
      const jsonDict = iterateSchema(regular.schema, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, {})
      const columns = iterateJsonDict(jsonDict, {}, [], rootKeys, sortOrder)
      expect(columns).toEqual(regular.columnsSchemaOnly)
    })

    it('should return one state object utilizing Schema keys and object keys, when input is a flat object', () => {
      const sortOrder = {
        current: { counter: Number.MIN_SAFE_INTEGER, dict: { '/c': 15 } },
      }
      const jsonDict = iterateSchema(regular.schema, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, regular.object1)
      sortOrder.counter = 0
      const columns = iterateJsonDict(jsonDict, regular.object1, [], rootKeys, sortOrder)
      expect(columns).toEqual(regular.columnsSchemaAndObject1)
    })

    it('should return three state objects, when input is an empty object and the path is provided', () => {
      const sortOrder = { current: { counter: 0, dict: {} } }
      const jsonDict = iterateSchema(deeplyNestedObject.schema, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(deeplyNestedObject.schema, {})
      const columns = iterateJsonDict(
        jsonDict,
        {},
        deeplyNestedObject.fieldPathNested,
        rootKeys,
        sortOrder,
      )
      expect(columns).toEqual(deeplyNestedObject.columnsNested)
    })

    it('should return three state objects, when input is an object, no Schema and path is provided', () => {
      const sortOrder = { current: { counter: 0, dict: {} } }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, deeplyNestedObject.object1)
      const columns = iterateJsonDict(
        jsonDict,
        deeplyNestedObject.object1,
        deeplyNestedObject.fieldPath1,
        rootKeys,
        sortOrder,
      )
      expect(columns).toEqual(deeplyNestedObject.columns1)
    })

    it('should set same sortIndexes on re-render', () => {
      const sortOrder = { current: { counter: 0, dict: {} } }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, {})
      iterateJsonDict(jsonDict, {}, [], rootKeys, sortOrder)
      iterateJsonDict(jsonDict, {}, [], rootKeys, sortOrder)
      const columnsRerender = iterateJsonDict(jsonDict, {}, [], rootKeys, sortOrder)
      expect(columnsRerender).toEqual([{ parent: {}, items: [] }])
    })

    it('should add sortIndexes to object', () => {
      const sortOrder = { current: { counter: 0, dict: sorted.sortOrder1 } }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, sorted.object)
      const columns = iterateJsonDict(jsonDict, sorted.object, [], rootKeys, sortOrder)
      expect(columns).toEqual(sorted.columns1)
    })

    it('should add sortIndexes to nested fields of object', () => {
      const sortOrder = { current: { counter: 0, dict: sorted.sortOrder2 } }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, sorted.object)
      const columns = iterateJsonDict(
        jsonDict,
        sorted.object,
        ['a', 'b'],
        rootKeys,
        sortOrder,
      )
      expect(columns).toEqual(sorted.columns2)
    })
  })
})
