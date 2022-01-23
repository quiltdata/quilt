import { EMPTY_VALUE } from '../constants'

export const schema = {
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

export const jsonDict = {
  '/a': {
    address: ['a'],
    required: false,
    valueSchema: {
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
    sortIndex: 1,
    type: 'object',
  },
  '/a/b': {
    address: ['a', 'b'],
    required: false,
    valueSchema: {
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
    sortIndex: 3,
    type: 'object',
  },
  '/a/b/c': {
    address: ['a', 'b', 'c'],
    required: false,
    valueSchema: {
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
    sortIndex: 5,
    type: 'object',
  },
  '/a/b/c/d': {
    address: ['a', 'b', 'c', 'd'],
    required: false,
    valueSchema: {
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
    sortIndex: 7,
    type: 'object',
  },
  '/a/b/c/d/e': {
    address: ['a', 'b', 'c', 'd', 'e'],
    required: false,
    valueSchema: {
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
    sortIndex: 9,
    type: 'object',
  },
  '/a/b/c/d/e/f': {
    address: ['a', 'b', 'c', 'd', 'e', 'f'],
    required: false,
    valueSchema: {
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
    sortIndex: 11,
    type: 'object',
  },
  '/a/b/c/d/e/f/g': {
    address: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    required: false,
    valueSchema: {
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
    sortIndex: 13,
    type: 'object',
  },
  '/a/b/c/d/e/f/g/h': {
    address: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    required: false,
    valueSchema: {
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
    sortIndex: 15,
    type: 'object',
  },
  '/a/b/c/d/e/f/g/h/i': {
    address: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
    required: false,
    valueSchema: {
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
    sortIndex: 17,
    type: 'object',
  },
  '/a/b/c/d/e/f/g/h/i/j': {
    address: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    required: false,
    valueSchema: {
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
    sortIndex: 19,
    type: 'object',
  },
  '/a/b/c/d/e/f/g/h/i/j/k': {
    address: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
    required: false,
    valueSchema: {
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
    sortIndex: 21,
    type: 'object',
  },
  '/a/b/c/d/e/f/g/h/i/j/k/testMaxItems': {
    address: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'testMaxItems'],
    required: false,
    valueSchema: {
      type: 'array',
      items: [
        {
          type: 'number',
          maxItems: 3,
        },
      ],
    },
    sortIndex: 23,
    type: 'array',
  },
}

export const fieldPathNested = ['a', 'b', 'c']

export const columnsNested = [
  {
    parent: {},
    items: [
      {
        errors: [],
        key: 'a',
        reactId: '/a+undefined',
        address: ['a'],
        required: false,
        valueSchema: schema.properties.a,
        sortIndex: 1,
        type: 'object',
        value: EMPTY_VALUE,
      },
    ],
  },
  {
    parent: undefined,
    items: [
      {
        errors: [],
        key: 'b',
        reactId: '/a/b+undefined',
        address: ['a', 'b'],
        required: false,
        valueSchema: schema.properties.a.properties.b,
        sortIndex: 3,
        type: 'object',
        value: EMPTY_VALUE,
      },
    ],
  },
  {
    parent: undefined,
    items: [
      {
        errors: [],
        key: 'c',
        reactId: '/a/b/c+undefined',
        valueSchema: schema.properties.a.properties.b.properties.c,
        address: ['a', 'b', 'c'],
        required: false,
        sortIndex: 5,
        type: 'object',
        value: EMPTY_VALUE,
      },
    ],
  },
  {
    parent: undefined,
    items: [
      {
        errors: [],
        key: 'd',
        reactId: '/a/b/c/d+undefined',
        address: ['a', 'b', 'c', 'd'],
        required: false,
        valueSchema: schema.properties.a.properties.b.properties.c.properties.d,
        sortIndex: 7,
        type: 'object',
        value: EMPTY_VALUE,
      },
    ],
  },
]

export const fieldPath1 = ['a', 'b', 2, 'c', 0, 'd', 'e']

export const object1 = {
  a: {
    b: [
      1,
      2,
      {
        c: [
          {
            d: {
              e: [1, 2, 3],
            },
          },
        ],
      },
    ],
  },
}

export const columns1 = [
  {
    parent: { a: { b: [1, 2, { c: [{ d: { e: [1, 2, 3] } }] }] } },
    items: [
      {
        errors: [],
        key: 'a',
        value: { b: [1, 2, { c: [{ d: { e: [1, 2, 3] } }] }] },
        reactId: '/a+{"b":[1,2,{"c":[{"d":{"e":[1,2,3]}}]}]}',
        sortIndex: 0,
      },
    ],
  },
  {
    parent: { b: [1, 2, { c: [{ d: { e: [1, 2, 3] } }] }] },
    items: [
      {
        errors: [],
        key: 'b',
        value: [1, 2, { c: [{ d: { e: [1, 2, 3] } }] }],
        reactId: '/a/b+[1,2,{"c":[{"d":{"e":[1,2,3]}}]}]',
        sortIndex: 0,
      },
    ],
  },
  {
    parent: [1, 2, { c: [{ d: { e: [1, 2, 3] } }] }],
    items: [
      { errors: [], key: 0, value: 1, reactId: '/a/b/0+1', sortIndex: 0 },
      { errors: [], key: 1, value: 2, reactId: '/a/b/1+2', sortIndex: 0 },
      {
        errors: [],
        key: 2,
        value: { c: [{ d: { e: [1, 2, 3] } }] },
        reactId: '/a/b/2+{"c":[{"d":{"e":[1,2,3]}}]}',
        sortIndex: 0,
      },
    ],
  },
  {
    items: [
      {
        errors: [],
        key: 'c',
        reactId: '/a/b/2/c+[{"d":{"e":[1,2,3]}}]',
        sortIndex: 0,
        value: [
          {
            d: {
              e: [1, 2, 3],
            },
          },
        ],
      },
    ],
    parent: {
      c: [
        {
          d: {
            e: [1, 2, 3],
          },
        },
      ],
    },
  },

  {
    items: [
      {
        errors: [],
        key: 0,
        reactId: '/a/b/2/c/0+{"d":{"e":[1,2,3]}}',
        sortIndex: 0,
        value: {
          d: {
            e: [1, 2, 3],
          },
        },
      },
    ],
    parent: [
      {
        d: {
          e: [1, 2, 3],
        },
      },
    ],
  },
  {
    items: [
      {
        errors: [],
        key: 'd',
        reactId: '/a/b/2/c/0/d+{"e":[1,2,3]}',
        sortIndex: 0,
        value: {
          e: [1, 2, 3],
        },
      },
    ],
    parent: {
      d: {
        e: [1, 2, 3],
      },
    },
  },
  {
    items: [
      {
        errors: [],
        key: 'e',
        reactId: '/a/b/2/c/0/d/e+[1,2,3]',
        sortIndex: 0,
        value: [1, 2, 3],
      },
    ],
    parent: {
      e: [1, 2, 3],
    },
  },
  {
    items: [
      {
        errors: [],
        key: 0,
        reactId: '/a/b/2/c/0/d/e/0+1',
        sortIndex: 0,
        value: 1,
      },
      {
        errors: [],
        key: 1,
        reactId: '/a/b/2/c/0/d/e/1+2',
        sortIndex: 0,
        value: 2,
      },
      {
        errors: [],
        key: 2,
        reactId: '/a/b/2/c/0/d/e/2+3',
        sortIndex: 0,
        value: 3,
      },
    ],
    parent: [1, 2, 3],
  },
]
