export const schema = {}

export const jsonDict = {}

export const columns1 = [
  {
    items: [
      {
        address: ['a'],
        errors: [],
        key: 'a',
        reactId: '/a+{"b":{"123":123,"c":"ccc","d":"ddd"}}',
        required: false,
        sortIndex: 1,
        value: { b: { 123: 123, c: 'ccc', d: 'ddd' } },
        valueSchema: undefined,
      },
      {
        address: ['123'],
        errors: [],
        key: '123',
        reactId: '/123+123',
        required: false,
        sortIndex: 2,
        value: 123,
        valueSchema: undefined,
      },
      {
        address: ['b'],
        errors: [],
        key: 'b',
        reactId: '/b+"bbb"',
        required: false,
        sortIndex: 3,
        value: 'bbb',
        valueSchema: undefined,
      },
    ],
    parent: { 123: 123, a: { b: { 123: 123, c: 'ccc', d: 'ddd' } }, b: 'bbb' },
  },
]

export const columns2 = [
  {
    items: [
      {
        address: ['a'],
        errors: [],
        key: 'a',
        reactId: '/a+{"b":{"123":123,"c":"ccc","d":"ddd"}}',
        required: false,
        sortIndex: 0,
        value: { b: { 123: 123, c: 'ccc', d: 'ddd' } },
        valueSchema: undefined,
      },
      {
        address: ['b'],
        errors: [],
        key: 'b',
        reactId: '/b+"bbb"',
        required: false,
        sortIndex: 0,
        value: 'bbb',
        valueSchema: undefined,
      },
      {
        address: ['123'],
        errors: [],
        key: '123',
        reactId: '/123+123',
        required: false,
        sortIndex: 1,
        value: 123,
        valueSchema: undefined,
      },
    ],
    parent: { 123: 123, a: { b: { 123: 123, c: 'ccc', d: 'ddd' } }, b: 'bbb' },
  },
  {
    items: [
      {
        address: ['a', 'b'],
        errors: [],
        key: 'b',
        reactId: '/a/b+{"123":123,"c":"ccc","d":"ddd"}',
        required: false,
        sortIndex: 0,
        value: {
          123: 123,
          c: 'ccc',
          d: 'ddd',
        },
        valueSchema: undefined,
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
        address: ['a', 'b', '123'],
        errors: [],
        key: '123',
        reactId: '/a/b/123+123',
        required: false,
        sortIndex: 0,
        value: 123,
        valueSchema: undefined,
      },
      {
        address: ['a', 'b', 'd'],
        errors: [],
        key: 'd',
        reactId: '/a/b/d+"ddd"',
        required: false,
        sortIndex: 2,
        value: 'ddd',
        valueSchema: undefined,
      },
      {
        address: ['a', 'b', 'c'],
        errors: [],
        key: 'c',
        reactId: '/a/b/c+"ccc"',
        required: false,
        sortIndex: 3,
        value: 'ccc',
        valueSchema: undefined,
      },
    ],
    parent: {
      123: 123,
      c: 'ccc',
      d: 'ddd',
    },
  },
]

export const sortOrder1 = { '/a': 1, '/123': 2, '/b': 3 }

export const sortOrder2 = { '/123': 1, '/a/b/c': 3, '/a/b/d': 2 }

export const object = { a: { b: { c: 'ccc', d: 'ddd', 123: 123 } }, b: 'bbb', 123: 123 }
