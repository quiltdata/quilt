import { iterateJsonDict, iterateSchema, mergeSchemaAndObjRootKeys } from './State'

import * as booleansNulls from './mocks/booleans-nulls'
import * as deeplyNestedArray from './mocks/deeply-nested-array'
import * as deeplyNestedObject from './mocks/deeply-nested-object'
import * as regular from './mocks/regular'

describe('Root keys for JSON editor', () => {
  it('contains root keys of given object', () => {
    const rootKeys = mergeSchemaAndObjRootKeys({}, { a: 1, b: 2, c: 3 })
    expect(rootKeys).toEqual(['a', 'b', 'c'])
  })

  it('contains root keys of schema', () => {
    const rootKeys = mergeSchemaAndObjRootKeys(booleansNulls.schema, {})
    expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool'])
  })

  it('contains both keys of object and schema, schema first', () => {
    const rootKeys = mergeSchemaAndObjRootKeys(booleansNulls.schema, { 1: 1, z: 'z' })
    expect(rootKeys).toEqual(['nullValue', 'boolValue', 'enumBool', '1', 'z'])
  })

  // FIXME
  it.skip('contains both keys of object and schema, required first', () => {
    const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, { 1: 1, z: 'z' })
    expect(rootKeys).toEqual(['a', 'b', 'optList', 'optEnum', '1', 'z'])
  })
})

describe('JSON dict', () => {
  it('empty for no schema', () => {
    const jsonDict = iterateSchema({}, { current: 0 }, [], {})
    expect(jsonDict).toEqual({})
  })

  it('contains values for flat schema', () => {
    const jsonDict = iterateSchema(booleansNulls.schema, { current: 0 }, [], {})
    expect(jsonDict).toEqual(booleansNulls.jsonDict)
  })

  it('contains values for every nesting level of schema, object', () => {
    const jsonDict = iterateSchema(deeplyNestedObject.schema, { current: 0 }, [], {})
    expect(jsonDict).toEqual(deeplyNestedObject.jsonDict)
  })

  it("doesn't contain values for every nesting level of schema, array", () => {
    const jsonDict = iterateSchema(deeplyNestedArray.schema, { current: 0 }, [], {})
    expect(jsonDict).toEqual(deeplyNestedArray.jsonDict)
  })
})

describe('UI columns', () => {
  it('has one empty column for empty object', () => {
    const jsonDict = iterateSchema({}, { current: 0 }, [], {})
    const rootKeys = mergeSchemaAndObjRootKeys({}, {})
    const columns = iterateJsonDict(jsonDict, {}, [], rootKeys)
    expect(columns).toEqual([{ parent: {}, items: [] }])
  })

  it('has one column with schema keys for empty object', () => {
    const jsonDict = iterateSchema(regular.schema, { current: 0 }, [], {})
    const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, {})
    const columns = iterateJsonDict(jsonDict, {}, [], rootKeys)
    expect(columns).toEqual(regular.columnsSchemaOnly)
  })

  it('has one column with schema keys for flat object', () => {
    const jsonDict = iterateSchema(regular.schema, { current: 0 }, [], {})
    const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, regular.object1)
    const columns = iterateJsonDict(jsonDict, regular.object1, [], rootKeys)
    expect(columns).toEqual(regular.columnsSchemaAndObject1)
  })

  it('has three columns for empty object and path', () => {
    const jsonDict = iterateSchema(deeplyNestedObject.schema, { current: 0 }, [], {})
    const rootKeys = mergeSchemaAndObjRootKeys(regular.schema, {})
    const columns = iterateJsonDict(
      jsonDict,
      {},
      deeplyNestedObject.fieldPathNested,
      rootKeys,
    )
    expect(columns).toEqual(deeplyNestedObject.columnsNested)
  })

  it('has three columns for given object and path', () => {
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
