import { makeSchemaDefaultsSetter, makeSchemaValidator } from './json-schema'

import * as booleansNulls from './mocks/booleans-nulls'
import * as compound from './mocks/compound'
import * as deeplyNestedArray from './mocks/deeply-nested-array'
import * as incorrect from './mocks/incorrect'
import * as regular from './mocks/regular'

describe('utils/json-schema', () => {
  describe('makeSchemaValidator', () => {
    it('should return error, when keyword is required but is not provided', () => {
      const validate = makeSchemaValidator(regular.schema)

      const obj = { optList: [{ id: 1, name: 'Name' }], optEnum: 'one' }
      const errors = validate(obj)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        keyword: 'required',
        params: { missingProperty: 'b' },
      })
    })

    it('should return an error when schema is incorrect', () => {
      expect(makeSchemaValidator(incorrect.schema)()[0].message).toMatch(
        /schema is invalid/,
      )
    })

    describe('validator for Schema with enum types', () => {
      const validate = makeSchemaValidator(regular.schema)

      it("should return error, when value doesn't match enum", () => {
        const invalid = { a: 123, b: 'value', optEnum: 'value' }
        const errors = validate(invalid)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toMatchObject({ instancePath: '/optEnum', keyword: 'enum' })
      })

      it("shouldn't return error, when value matches enum", () => {
        const valid = { a: 123, b: 'value', optEnum: 'one' }
        expect(validate(valid)).toHaveLength(0)
      })
    })

    describe('validator for Schema with deeply nested array', () => {
      const validate = makeSchemaValidator(deeplyNestedArray.schema)

      it("should return error, when value doesn't match this array structure", () => {
        const invalid = { longNestedList: [{}] }
        const errors = validate(invalid)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toMatchObject({
          instancePath: '/longNestedList/0',
          keyword: 'type',
        })
      })

      it("should return error, when value doesn't match last nesting level of array structure", () => {
        const invalid = { longNestedList: [[[[[[[[[['string']]]]]]]]]] }
        const errors = validate(invalid)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toMatchObject({
          instancePath: '/longNestedList/0/0/0/0/0/0/0/0/0/0',
          keyword: 'type',
        })
      })

      it("should return error, when value doesn't match one of array items at last nesting level of array structure", () => {
        const invalid = { longNestedList: [[[[[[[[[[1, 2, 3, 4, 'string']]]]]]]]]] }
        const errors = validate(invalid)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toMatchObject({
          instancePath: '/longNestedList/0/0/0/0/0/0/0/0/0/4',
          keyword: 'type',
        })
      })

      it("shouldn't return error, when value matches array structure and types inside last nesting level", () => {
        const valid = { longNestedList: [[[[[[[[[[1, 2.5, 3, 10e100]]]]]]]]]] }
        expect(validate(valid)).toHaveLength(0)
      })
    })

    describe('validator for Schema with number and string types', () => {
      const validate = makeSchemaValidator(regular.schema)

      it('should return error, when number is expected but string is provided', () => {
        const invalidNumber = { a: 'b', b: 'b' }
        const errorsNumber = validate(invalidNumber)
        expect(errorsNumber).toHaveLength(1)
        expect(errorsNumber[0]).toMatchObject({ instancePath: '/a', keyword: 'type' })
      })

      it('should return error, when string is expected but number is provided', () => {
        const invalidString = { a: 123, b: 123 }
        const errorsString = validate(invalidString)
        expect(errorsString).toHaveLength(1)
        expect(errorsString[0]).toMatchObject({ instancePath: '/b', keyword: 'type' })
      })

      it("shouldn't return error, when object matches Schema types", () => {
        const valid = { a: 123, b: 'b' }
        expect(validate(valid)).toHaveLength(0)
      })
    })

    describe('validator for Schema with boolean and null types', () => {
      const validate = makeSchemaValidator(booleansNulls.schema)

      it("should return error, when value doesn't match null", () => {
        const invalidNull = { nullValue: 123 }
        const errorsNull = validate(invalidNull)
        expect(errorsNull).toHaveLength(1)
        expect(errorsNull[0]).toMatchObject({
          instancePath: '/nullValue',
          keyword: 'type',
        })
      })

      it("should return error, when value doesn't match boolean", () => {
        const invalidBool = { boolValue: 0 }
        const errorsBool = validate(invalidBool)
        expect(errorsBool).toHaveLength(1)
        expect(errorsBool[0]).toMatchObject({
          instancePath: '/boolValue',
          keyword: 'type',
        })
      })

      it("should return error, when value doesn't match boolean as enum", () => {
        const invalidEnum = { enumBool: null }
        const errorsEnum = validate(invalidEnum)
        expect(errorsEnum).toHaveLength(2)
        expect(errorsEnum[0]).toMatchObject({
          instancePath: '/enumBool',
          keyword: 'type',
        })
        expect(errorsEnum[1]).toMatchObject({
          instancePath: '/enumBool',
          keyword: 'enum',
        })
      })

      it("shouldn't return error, when object matches Schema types", () => {
        const valid = {
          nullValue: null,
          boolValue: true,
          enumBool: false,
          extraKey: 'extra value',
        }
        expect(validate(valid)).toHaveLength(0)
      })
    })

    describe('validator for Schema with compound types', () => {
      const validate = makeSchemaValidator(compound.schemaAnyOf)

      it("shouldn't return error, when value is empty", () => {
        const emptyObject = {}
        expect(validate(emptyObject)).toEqual([])
      })

      it("shouldn't return error, when value doesn't match anyOf types", () => {
        const invalidAnyOf = { numOrString: [] }
        const errorsAnyOf = validate(invalidAnyOf)
        expect(errorsAnyOf).toHaveLength(3)
        expect(errorsAnyOf).toMatchObject([
          {
            instancePath: '/numOrString',
            keyword: 'type',
          },
          {
            instancePath: '/numOrString',
            keyword: 'type',
          },
          {
            instancePath: '/numOrString',
            keyword: 'anyOf',
          },
        ])
      })

      it("shouldn't return error, when value doesn't match oneOf types", () => {
        const invalidOneOf = { intOrNonNumberOrLess3: 4.5 }
        const errorsOneOf = validate(invalidOneOf)
        expect(errorsOneOf).toHaveLength(3)
        expect(errorsOneOf).toMatchObject([
          {
            instancePath: '/intOrNonNumberOrLess3',
            keyword: 'maximum',
          },
          {
            instancePath: '/intOrNonNumberOrLess3',
            keyword: 'type',
          },
          {
            instancePath: '/intOrNonNumberOrLess3',
            keyword: 'oneOf',
          },
        ])
      })

      it("shouldn't return error, when value doesn't match `allOf` type", () => {
        const invalidAllOf = { intLessThan3: 'a' }
        const errorsAllOf = validate(invalidAllOf)
        expect(errorsAllOf).toHaveLength(2)
        expect(errorsAllOf[0]).toMatchObject({
          instancePath: '/intLessThan3',
          keyword: 'type',
        })
        expect(errorsAllOf[1]).toMatchObject({
          instancePath: '/intLessThan3',
          keyword: 'type',
        })
      })

      it("shouldn't return error, when value doesn't match `allOf` comparing condition", () => {
        const invalidAllOf = { intLessThan3: 3.5 }
        const errorsAllOf = validate(invalidAllOf)
        expect(errorsAllOf).toHaveLength(2)
        expect(errorsAllOf[0]).toMatchObject({
          instancePath: '/intLessThan3',
          keyword: 'maximum',
        })
        expect(errorsAllOf[1]).toMatchObject({
          instancePath: '/intLessThan3',
          keyword: 'type',
        })
      })

      it("shouldn't return error, when object matches Schema types", () => {
        const validObj = { numOrString: 3.5, intOrNonNumberOrLess3: 2.5, intLessThan3: 2 }
        const errors = validate(validObj)
        expect(errors).toHaveLength(0)
      })
    })

    describe('validator for Schema with types as array', () => {
      const validate = makeSchemaValidator(compound.schemaTypeArray, [], {
        allowUnionTypes: true,
      })

      it("should return error, when root property doesn't match type", () => {
        const invalidProperty = { strOrNum: [], strOrNumList: [{}, null, true] }
        const errorsProperty = validate(invalidProperty)
        expect(errorsProperty).toHaveLength(4)
        expect(errorsProperty[0]).toMatchObject({
          instancePath: '/strOrNum',
          keyword: 'type',
        })
        expect(errorsProperty[1]).toMatchObject({
          instancePath: '/strOrNumList/0',
          keyword: 'type',
        })
      })

      it("should return error, when first element inside array doesn't match type", () => {
        const invalidItem = { strOrNum: 123, strOrNumList: [{}, null, true] }
        const errorsItem = validate(invalidItem)
        expect(errorsItem).toHaveLength(3)
        expect(errorsItem[0]).toMatchObject({
          instancePath: '/strOrNumList/0',
          keyword: 'type',
        })
        expect(errorsItem[1]).toMatchObject({
          instancePath: '/strOrNumList/1',
          keyword: 'type',
        })
        expect(errorsItem[2]).toMatchObject({
          instancePath: '/strOrNumList/2',
          keyword: 'type',
        })
      })

      it("should return error, when second element inside array doesn't match type", () => {
        const invalidItem = { strOrNum: 123, strOrNumList: [123, null, true] }
        const errorsItem = validate(invalidItem)
        expect(errorsItem).toHaveLength(2)
        expect(errorsItem[0]).toMatchObject({
          instancePath: '/strOrNumList/1',
          keyword: 'type',
        })
        expect(errorsItem[1]).toMatchObject({
          instancePath: '/strOrNumList/2',
          keyword: 'type',
        })
      })

      it("shouldn't return error, when value matches first type from array", () => {
        const validString = { strOrNum: 'string', strOrNumList: ['one', 2, 2.5, 0] }
        expect(validate(validString)).toHaveLength(0)
      })

      it("shouldn't return error, when value matches second type from array", () => {
        const validNumber = { strOrNum: 123, strOrNumList: [1, 2, 3] }
        expect(validate(validNumber)).toHaveLength(0)
      })
    })
  })

  describe('makeSchemaDefaultsSetter', () => {
    const setDefaults = makeSchemaDefaultsSetter(regular.schema)

    it('should set default value from Schema, when value is empty', () => {
      expect(setDefaults({})).toMatchObject({
        a: 3.14,
      })
    })

    it('should set default value from Schema, when nested value set', () => {
      expect(setDefaults({ optList: [{}] })).toMatchObject({
        optList: [
          {
            id: 123,
            name: 'Abcdef',
          },
        ],
      })
    })

    it('should return the same value if no schema', () => {
      const obj = { a: 1 }
      expect(makeSchemaDefaultsSetter()(obj)).toBe(obj)
    })

    it('should return the same value if no properties schema', () => {
      const obj = { a: 1 }
      const schema = { type: 'array', items: { type: 'number' } }
      expect(makeSchemaDefaultsSetter(schema)(obj)).toBe(obj)
    })

    it('should return value with defaults', () => {
      const obj = { a: { b: 1 } }
      const schema = {
        type: 'object',
        properties: {
          a: {
            type: 'object',
            properties: {
              b: { type: 'string', default: 'User set it' },
              c: { type: 'number', default: 123 },
              d: {
                type: 'object',
                properties: {
                  e: {
                    type: 'object',
                    properties: {
                      f: { type: 'number', default: 456 },
                    },
                  },
                },
              },
            },
          },
          g: { type: 'number', default: 789 },
        },
      }
      expect(makeSchemaDefaultsSetter(schema)(obj)).toMatchObject({
        a: {
          b: 1,
          c: 123,
          d: {
            e: {
              f: 456,
            },
          },
        },
        g: 789,
      })
    })

    it('should return value with prepopulated date', () => {
      jest.useFakeTimers('modern')
      jest.setSystemTime(new Date(2020, 0, 30))

      const obj = { a: { b: 1 } }
      const schema = {
        type: 'object',
        properties: {
          a: {
            type: 'object',
            properties: {
              b: { type: 'string', format: 'date', dateformat: 'yyyy-MM-dd' },
              c: { type: 'string', format: 'date', dateformat: 'yyyy-MM-dd' },
              d: {
                type: 'object',
                properties: {
                  e: {
                    type: 'object',
                    properties: {
                      f: { type: 'string', format: 'date', dateformat: 'yyyy-MM-dd' },
                    },
                  },
                },
              },
            },
          },
          g: { type: 'string', format: 'date', dateformat: 'yyyy-MM-dd' },
        },
      }
      expect(makeSchemaDefaultsSetter(schema)(obj)).toMatchObject({
        a: {
          b: 1,
          c: '2020-01-30',
          d: {
            e: {
              f: '2020-01-30',
            },
          },
        },
        g: '2020-01-30',
      })
      jest.useRealTimers()
    })
  })
})
