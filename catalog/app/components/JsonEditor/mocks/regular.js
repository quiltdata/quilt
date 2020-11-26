import { EMPTY_VALUE } from '../State'

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
          },
          name: {
            type: 'string',
          },
        },
      },
    },
    a: {
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

export const jsonDict = {}

export const columnsSchemaOnly = [
  {
    parent: {},
    items: [
      {
        key: 'a',
        reactId: 'a+undefined',
        address: ['a'],
        required: true,
        valueSchema: { type: 'number' },
        sortIndex: 1,
        type: 'number',
        value: EMPTY_VALUE,
      },
      {
        key: 'b',
        reactId: 'b+undefined',
        address: ['b'],
        required: true,
        valueSchema: { type: 'string' },
        sortIndex: 3,
        type: 'string',
        value: EMPTY_VALUE,
      },
      {
        key: 'optList',
        reactId: 'optList+undefined',
        address: ['optList'],
        required: false,
        valueSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, name: { type: 'string' } },
          },
        },
        sortIndex: 5,
        type: 'array',
        value: EMPTY_VALUE,
      },
      {
        key: 'optEnum',
        reactId: 'optEnum+undefined',
        address: ['optEnum'],
        required: false,
        valueSchema: { type: 'string', enum: ['one', 'two', 'three'] },
        sortIndex: 7,
        type: 'string',
        value: EMPTY_VALUE,
      },
      {
        key: 'enumObjects',
        reactId: 'enumObjects+undefined',
        address: ['enumObjects'],
        required: false,
        valueSchema: { type: 'object', enum: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        sortIndex: 9,
        type: 'object',
        value: EMPTY_VALUE,
      },
      {
        key: 'enumArrays',
        reactId: 'enumArrays+undefined',
        address: ['enumArrays'],
        required: false,
        valueSchema: {
          type: 'array',
          enum: [
            [1, 2, 3],
            [3, 4, 5],
            [6, 7, 8],
          ],
        },
        sortIndex: 11,
        type: 'array',
        value: EMPTY_VALUE,
      },
      {
        key: 'enumArraysAndObjects',
        reactId: 'enumArraysAndObjects+undefined',
        address: ['enumArraysAndObjects'],
        required: false,
        valueSchema: {
          type: 'array',
          enum: [
            ['miles', { format: '12h' }],
            ['kilometers', { format: '24h' }],
            { name: 'unspecified' },
          ],
        },
        sortIndex: 13,
        type: 'array',
        value: EMPTY_VALUE,
      },
    ],
  },
]

export const object1 = { a: 1, 111: 'aaa', c: [1, 2, 3], d: { e: 'f' } }

export const columnsSchemaAndObject1 = [
  {
    parent: object1,
    items: [
      {
        key: 'a',
        value: 1,
        reactId: 'a+1',
        address: ['a'],
        required: true,
        valueSchema: { type: 'number' },
        sortIndex: 1,
        type: 'number',
      },
      {
        key: 'b',
        reactId: 'b+undefined',
        address: ['b'],
        required: true,
        valueSchema: { type: 'string' },
        sortIndex: 3,
        type: 'string',
        value: EMPTY_VALUE,
      },
      {
        key: 'optList',
        reactId: 'optList+undefined',
        address: ['optList'],
        required: false,
        valueSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, name: { type: 'string' } },
          },
        },
        sortIndex: 5,
        type: 'array',
        value: EMPTY_VALUE,
      },
      {
        key: 'optEnum',
        reactId: 'optEnum+undefined',
        address: ['optEnum'],
        required: false,
        valueSchema: { type: 'string', enum: ['one', 'two', 'three'] },
        sortIndex: 7,
        type: 'string',
        value: EMPTY_VALUE,
      },
      {
        key: 'enumObjects',
        reactId: 'enumObjects+undefined',
        address: ['enumObjects'],
        required: false,
        valueSchema: { type: 'object', enum: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        sortIndex: 9,
        type: 'object',
        value: EMPTY_VALUE,
      },
      {
        key: 'enumArrays',
        reactId: 'enumArrays+undefined',
        address: ['enumArrays'],
        required: false,
        valueSchema: {
          type: 'array',
          enum: [
            [1, 2, 3],
            [3, 4, 5],
            [6, 7, 8],
          ],
        },
        sortIndex: 11,
        type: 'array',
        value: EMPTY_VALUE,
      },
      {
        key: 'enumArraysAndObjects',
        reactId: 'enumArraysAndObjects+undefined',
        address: ['enumArraysAndObjects'],
        required: false,
        valueSchema: {
          type: 'array',
          enum: [
            ['miles', { format: '12h' }],
            ['kilometers', { format: '24h' }],
            { name: 'unspecified' },
          ],
        },
        sortIndex: 13,
        type: 'array',
        value: EMPTY_VALUE,
      },
      { key: '111', value: 'aaa', reactId: '111+"aaa"' },
      { key: 'c', value: [1, 2, 3], reactId: 'c+[1,2,3]' },
      { key: 'd', value: { e: 'f' }, reactId: 'd+{"e":"f"}' },
    ],
  },
]
