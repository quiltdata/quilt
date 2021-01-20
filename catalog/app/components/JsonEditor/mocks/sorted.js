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

export const sortOrder1 = { a: 1, 123: 2, b: 3 }

export const object = { a: { b: { c: 'ccc', d: 'ddd', 123: 123 } }, b: 'bbb', 123: 123 }
