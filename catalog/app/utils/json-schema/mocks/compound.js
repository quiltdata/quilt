export const schemaAnyOf = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-any-of.json',
  type: 'object',
  properties: {
    numOrString: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'string',
        },
      ],
    },
    intOrNonNumberOrLess3: {
      oneOf: [{ maximum: 3, type: 'number' }, { type: 'integer' }],
    },
    intLessThan3: {
      allOf: [{ maximum: 3, type: 'number' }, { type: 'integer' }],
    },
  },
}

export const schemaTypeArray = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-type-array.json',
  type: 'object',
  properties: {
    strOrNum: {
      type: ['string', 'number'],
    },
    strOrNumList: {
      type: 'array',
      items: {
        type: ['string', 'number'],
      },
    },
  },
}
