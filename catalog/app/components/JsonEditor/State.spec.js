import { describe, it, expect } from 'vitest'

import * as stubs from 'utils/JSONSchema/__stubs__'

import {
  getJsonDictItemRecursively,
  iterateJsonDict,
  iterateSchema,
  mergeSchemaAndObjRootKeys,
} from './State'

describe('components/JsonEditor/State', () => {
  describe('mergeSchemaAndObjRootKeys', () => {
    it('should return root keys of a given object when no Schema', () => {
      const rootKeys = mergeSchemaAndObjRootKeys({}, { a: 1, b: 2, c: 3 })
      expect(rootKeys).toEqual(['a', 'b', 'c'])
    })

    it('should return root keys of Schema when no object', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(stubs.booleansNulls, {})
      expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool'])
    })

    it('should return both keys of object and Schema, Schema first', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(stubs.booleansNulls, { 1: 1, z: 'z' })
      expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool', '1', 'z'])
    })

    it('should return both keys of object and Schema, required first', () => {
      const rootKeys = mergeSchemaAndObjRootKeys(stubs.regular, { 1: 1, z: 'z' })
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
        stubs.booleansNulls,
        { current: { counter: 0 } },
        [],
        {},
      )
      expect(jsonDict).toMatchSnapshot()
    })

    it('should return values for every nesting level of Schema, when type is `object`', () => {
      const jsonDict = iterateSchema(
        stubs.deeplyNestedObject,
        { current: { counter: 0 } },
        [],
        {},
      )
      expect(jsonDict).toMatchSnapshot()
    })

    it('should return first value only for deep nesting level of Schema, when type is `array`', () => {
      const jsonDict = iterateSchema(
        stubs.deeplyNestedArray,
        { current: { counter: 0 } },
        [],
        {},
      )
      expect(jsonDict).toMatchSnapshot()
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
      const jsonDict = iterateSchema(stubs.regular, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(stubs.regular, {})
      const columns = iterateJsonDict(jsonDict, {}, [], rootKeys, sortOrder)
      expect(columns).toMatchSnapshot()
    })

    it('should return one state object utilizing Schema keys and object keys, when input is a flat object', () => {
      const object = { a: 1, 111: 'aaa', c: [1, 2, 3], d: { e: 'f' } }
      const sortOrder = {
        current: { counter: Number.MIN_SAFE_INTEGER, dict: { '/c': 15 } },
      }
      const jsonDict = iterateSchema(stubs.regular, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(stubs.regular, object)
      sortOrder.counter = 0
      const columns = iterateJsonDict(jsonDict, object, [], rootKeys, sortOrder)
      expect(columns).toMatchSnapshot()
    })

    it('should return three state objects, when input is an empty object and the path is provided', () => {
      const sortOrder = { current: { counter: 0, dict: {} } }
      const jsonDict = iterateSchema(stubs.deeplyNestedObject, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys(stubs.deeplyNestedObject, {})
      const columns = iterateJsonDict(jsonDict, {}, ['a', 'b', 'c'], rootKeys, sortOrder)
      expect(columns).toMatchSnapshot()
    })

    it('should return three state objects, when input is an object, no Schema and path is provided', () => {
      const object = { a: { b: [1, 2, { c: [{ d: { e: [1, 2, 3] } }] }] } }
      const sortOrder = { current: { counter: 0, dict: {} } }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, object)
      const columns = iterateJsonDict(
        jsonDict,
        object,
        ['a', 'b', 2, 'c', 0, 'd', 'e'],
        rootKeys,
        sortOrder,
      )
      expect(columns).toMatchSnapshot()
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
      const object = { a: { b: { c: 'ccc', d: 'ddd', 123: 123 } }, b: 'bbb', 123: 123 }
      const sortOrder = { current: { counter: 0, dict: { '/a': 1, '/123': 2, '/b': 3 } } }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, object)
      const columns = iterateJsonDict(jsonDict, object, [], rootKeys, sortOrder)
      expect(columns).toMatchSnapshot()
    })

    it('should add sortIndexes to nested fields of object', () => {
      const object = { a: { b: { c: 'ccc', d: 'ddd', 123: 123 } }, b: 'bbb', 123: 123 }
      const sortOrder = {
        current: { counter: 0, dict: { '/123': 1, '/a/b/c': 3, '/a/b/d': 2 } },
      }
      const jsonDict = iterateSchema({}, sortOrder, [], {})
      const rootKeys = mergeSchemaAndObjRootKeys({}, object)
      const columns = iterateJsonDict(jsonDict, object, ['a', 'b'], rootKeys, sortOrder)
      expect(columns).toMatchSnapshot()
    })
  })

  describe.skip('getJsonDictItemRecursively', () => {
    const dict = {
      '/c': 'found C',
      '/c/__*': 'found additional',
      '/c/__*/b': 'found B',
      '/c/__*/b/__*': 'found item',
    }
    expect(getJsonDictItemRecursively(dict, ['c'])).toBe('found C')
    expect(getJsonDictItemRecursively(dict, ['c', 'foo'])).toBe('found additional')
    expect(getJsonDictItemRecursively(dict, ['c', 'foo', 'b'])).toBe('found B')
    expect(getJsonDictItemRecursively(dict, ['c', 'foo', 'b', 'bar'])).toBe('found item')
  })
})
