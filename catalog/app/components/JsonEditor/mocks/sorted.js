export const schema = {}

export const jsonDict = {}

export const columns1 = [
  {
    items: [
      {
        key: 'a',
        reactId: 'a+{"b":{"123":123,"c":"ccc","d":"ddd"}}',
        sortIndex: 1,
        value: { b: { 123: 123, c: 'ccc', d: 'ddd' } },
      },
      { key: '123', reactId: '123+123', sortIndex: 2, value: 123 },
      { key: 'b', reactId: 'b+"bbb"', sortIndex: 3, value: 'bbb' },
    ],
    parent: { 123: 123, a: { b: { 123: 123, c: 'ccc', d: 'ddd' } }, b: 'bbb' },
  },
]

export const columns2 = [
  {
    items: [
      {
        key: 'a',
        reactId: 'a+{"b":{"123":123,"c":"ccc","d":"ddd"}}',
        sortIndex: 0,
        value: { b: { 123: 123, c: 'ccc', d: 'ddd' } },
      },
      { key: 'b', reactId: 'b+"bbb"', sortIndex: 0, value: 'bbb' },
      { key: '123', reactId: '123+123', sortIndex: 1, value: 123 },
    ],
    parent: { 123: 123, a: { b: { 123: 123, c: 'ccc', d: 'ddd' } }, b: 'bbb' },
  },
  {
    items: [
      {
        key: 'b',
        reactId: 'a, b+{"123":123,"c":"ccc","d":"ddd"}',
        sortIndex: 0,
        value: {
          123: 123,
          c: 'ccc',
          d: 'ddd',
        },
      },
    ],
    parent: {
      b: {
        123: 123,
        c: 'ccc',
        d: 'ddd',
      },
    },
  },
  {
    items: [
      {
        key: '123',
        reactId: 'a, b, 123+123',
        sortIndex: 0,
        value: 123,
      },
      {
        key: 'd',
        reactId: 'a, b, d+"ddd"',
        sortIndex: 2,
        value: 'ddd',
      },
      {
        key: 'c',
        reactId: 'a, b, c+"ccc"',
        sortIndex: 3,
        value: 'ccc',
      },
    ],
    parent: {
      123: 123,
      c: 'ccc',
      d: 'ddd',
    },
  },
]

export const sortOrder1 = { a: 1, 123: 2, b: 3 }

export const sortOrder2 = { 123: 1, 'a, b, c': 3, 'a, b, d': 2 }

export const object = { a: { b: { c: 'ccc', d: 'ddd', 123: 123 } }, b: 'bbb', 123: 123 }
