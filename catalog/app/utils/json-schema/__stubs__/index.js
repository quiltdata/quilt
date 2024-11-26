export const booleansNulls = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-bools-nulls.json',
  type: 'object',
  properties: {
    nullValue: {
      type: 'null',
    },
    boolValue: {
      type: 'boolean',
    },
    enumBool: {
      type: 'boolean',
      enum: [true, false],
    },
  },
}

export const deeplyNestedArray = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-nested-array.json',
  type: 'object',
  properties: {
    longNestedList: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'array',
          items: {
            type: 'array',
            items: {
              type: 'array',
              items: {
                type: 'array',
                items: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: {
                        type: 'array',
                        items: {
                          type: 'number',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

export const deeplyNestedObject = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-nested-long.json',
  type: 'object',
  properties: {
    a: {
      type: 'object',
      properties: {
        b: {
          type: 'object',
          properties: {
            c: {
              type: 'object',
              properties: {
                d: {
                  type: 'object',
                  properties: {
                    e: {
                      type: 'object',
                      properties: {
                        f: {
                          type: 'object',
                          properties: {
                            g: {
                              type: 'object',
                              properties: {
                                h: {
                                  type: 'object',
                                  properties: {
                                    i: {
                                      type: 'object',
                                      properties: {
                                        j: {
                                          type: 'object',
                                          properties: {
                                            k: {
                                              type: 'object',
                                              properties: {
                                                testMaxItems: {
                                                  type: 'array',
                                                  items: [
                                                    {
                                                      type: 'number',
                                                      maxItems: 3,
                                                    },
                                                  ],
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

export const regular = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema.json',
  type: 'object',
  properties: {
    optList: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            default: 123,
          },
          name: {
            type: 'string',
            default: 'Abcdef',
          },
        },
      },
    },
    a: {
      default: 1e10,
      type: 'number',
    },
    b: {
      type: 'string',
    },
    optEnum: {
      type: 'string',
      enum: ['one', 'two', 'three'],
    },
    enumObjects: {
      type: 'object',
      enum: [
        {
          id: 1,
        },
        {
          id: 2,
        },
        {
          id: 3,
        },
      ],
    },
    enumArrays: {
      type: 'array',
      enum: [
        [1, 2, 3],
        [3, 4, 5],
        [6, 7, 8],
      ],
    },
    enumArraysAndObjects: {
      type: 'array',
      enum: [
        [
          'miles',
          {
            format: '12h',
          },
        ],
        [
          'kilometers',
          {
            format: '24h',
          },
        ],
        {
          name: 'unspecified',
        },
      ],
    },
  },
  required: ['a', 'b'],
}

export const incorrect = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-incorrect.json',
  type: 'object',
  properties: {
    enumBool: {
      type: 'enum',
      enum: [true, false],
    },
  },
}

export const anyOf = {
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

export const typeArray = {
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
