import { makeSchemaValidator } from './json-schema'

import * as booleansNulls from '../components/JsonEditor/mocks/booleans-nulls'
import * as compound from '../components/JsonEditor/mocks/compound'
import * as deeplyNestedArray from '../components/JsonEditor/mocks/deeply-nested-array'
import * as incorrect from '../components/JsonEditor/mocks/incorrect'
import * as regular from '../components/JsonEditor/mocks/regular'

describe('utils/json-schema', () => {
  describe('makeSchemaValidator', () => {
    it('should return error, when keyword is required but is not provided', () => {
      const validate = makeSchemaValidator(regular.schema)

      const obj = { optList: [{ id: 1, name: 'Name' }], optEnum: 'one' }
      const errors = validate(obj)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        keyword: 'required',
        params: { missingProperty: 'a' },
      })
    })

    it('should throw an error when schema is incorrect', () => {
      const validate = makeSchemaValidator(incorrect.schema)
      const errors = validate({})

      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(Error)
      expect(errors[0].message).toMatch(/schema is invalid/)
    })

    describe('validator for Schema with enum types', () => {
      const validate = makeSchemaValidator(regular.schema)

      it("should return error, when value doesn't match enum", () => {
        const invalid = { a: 123, b: 'value', optEnum: 'value' }
        const errors = validate(invalid)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toMatchObject({ dataPath: '.optEnum', keyword: 'enum' })
      })

      it("shouldn't return error, when value doesn matches enum", () => {
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
          dataPath: '.longNestedList[0]',
          keyword: 'type',
        })
      })

      it("should return error, when value doesn't match last nesting level of array structure", () => {
        const invalid = { longNestedList: [[[[[[[[[['string']]]]]]]]]] }
        const errors = validate(invalid)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toMatchObject({
          dataPath: '.longNestedList[0][0][0][0][0][0][0][0][0][0]',
          keyword: 'type',
        })
      })

      it("should return error, when value doesn't match one of array items at last nesting level of array structure", () => {
        const invalid = { longNestedList: [[[[[[[[[[1, 2, 3, 4, 'string']]]]]]]]]] }
        const errors = validate(invalid)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toMatchObject({
          dataPath: '.longNestedList[0][0][0][0][0][0][0][0][0][4]',
          keyword: 'type',
        })
      })

      it("shouldn't return error, when value matches array structure and types inside last nesting level", () => {
        const valid = { longNestedList: [[[[[[[[[[1, 2.5, 3, 10e100, Infinity]]]]]]]]]] }
        expect(validate(valid)).toHaveLength(0)
      })
    })

    describe('validator for Schema with number and string types', () => {
      const validate = makeSchemaValidator(regular.schema)

      it('should return error, when number is expected but string is provided', () => {
        const invalidNumber = { a: 'b', b: 'b' }
        const errorsNumber = validate(invalidNumber)
        expect(errorsNumber).toHaveLength(1)
        expect(errorsNumber[0]).toMatchObject({ dataPath: '.a', keyword: 'type' })
      })

      it('should return error, when string is expected but number is provided', () => {
        const invalidString = { a: 123, b: 123 }
        const errorsString = validate(invalidString)
        expect(errorsString).toHaveLength(1)
        expect(errorsString[0]).toMatchObject({ dataPath: '.b', keyword: 'type' })
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
        expect(errorsNull[0]).toMatchObject({ dataPath: '.nullValue', keyword: 'type' })
      })

      it("should return error, when value doesn't match boolean", () => {
        const invalidBool = { boolValue: 0 }
        const errorsBool = validate(invalidBool)
        expect(errorsBool).toHaveLength(1)
        expect(errorsBool[0]).toMatchObject({ dataPath: '.boolValue', keyword: 'type' })
      })

      it("should return error, when value doesn't match boolean as enum", () => {
        const invalidEnum = { enumBool: null }
        const errorsEnum = validate(invalidEnum)
        expect(errorsEnum).toHaveLength(1)
        expect(errorsEnum[0]).toMatchObject({ dataPath: '.enumBool', keyword: 'type' })
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
            dataPath: '.numOrString',
            keyword: 'type',
          },
          {
            dataPath: '.numOrString',
            keyword: 'type',
          },
          {
            dataPath: '.numOrString',
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
            dataPath: '.intOrNonNumberOrLess3',
            keyword: 'maximum',
          },
          {
            dataPath: '.intOrNonNumberOrLess3',
            keyword: 'type',
          },
          {
            dataPath: '.intOrNonNumberOrLess3',
            keyword: 'oneOf',
          },
        ])
      })

      it("shouldn't return error, when value doesn't match `allOf` type", () => {
        const invalidAllOf = { intLessThan3: 'a' }
        const errorsAllOf = validate(invalidAllOf)
        expect(errorsAllOf).toHaveLength(1)
        expect(errorsAllOf[0]).toMatchObject({
          dataPath: '.intLessThan3',
          keyword: 'type',
        })
      })

      it("shouldn't return error, when value doesn't match `allOf` comparing condition", () => {
        const invalidAllOf = { intLessThan3: 3.5 }
        const errorsAllOf = validate(invalidAllOf)
        expect(errorsAllOf).toHaveLength(1)
        expect(errorsAllOf[0]).toMatchObject({
          dataPath: '.intLessThan3',
          keyword: 'maximum',
        })
      })

      it("shouldn't return error, when object matches Schema types", () => {
        const validObj = { numOrString: 3.5, intOrNonNumberOrLess3: 2.5, intLessThan3: 2 }
        const errors = validate(validObj)
        expect(errors).toHaveLength(0)
      })
    })

    describe('validator for Schema with types as array', () => {
      const validate = makeSchemaValidator(compound.schemaTypeArray)

      it("should return error, when root property doesn't match type", () => {
        const invalidProperty = { strOrNum: [], strOrNumList: [{}, null, true] }
        const errorsProperty = validate(invalidProperty)
        expect(errorsProperty).toHaveLength(1)
        expect(errorsProperty[0]).toMatchObject({
          dataPath: '.strOrNum',
          keyword: 'type',
        })
      })

      it("should return error, when first element inside array doesn't match type", () => {
        const invalidItem = { strOrNum: 123, strOrNumList: [{}, null, true] }
        const errorsItem = validate(invalidItem)
        expect(errorsItem).toHaveLength(1)
        expect(errorsItem[0]).toMatchObject({
          dataPath: '.strOrNumList[0]',
          keyword: 'type',
        })
      })

      it("should return error, when second element inside array doesn't match type", () => {
        const invalidItem = { strOrNum: 123, strOrNumList: [123, null, true] }
        const errorsItem = validate(invalidItem)
        expect(errorsItem).toHaveLength(1)
        expect(errorsItem[0]).toMatchObject({
          dataPath: '.strOrNumList[1]',
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
})
