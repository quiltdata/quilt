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
          },
          name: {
            type: 'string',
          },
        },
      },
    },
    a: {
      default: 1e10,
      type: 'number',
    },
    b: {
      default: 'Barcelona',
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
