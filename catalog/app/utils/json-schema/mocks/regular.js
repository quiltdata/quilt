export const schema = {
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
      type: 'number',
      default: 3.14,
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
