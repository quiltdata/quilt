import { EMPTY_VALUE } from '../constants'

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

export const jsonDict = {}

export const columnsSchemaOnly = [
  {
    parent: {},
    items: [
      {
        errors: [],
        key: 'a',
        reactId: '/a+undefined',
        address: ['a'],
        required: true,
        valueSchema: { default: 1e10, type: 'number' },
        sortIndex: 1,
        type: 'number',
        value: 10000000000,
      },
      {
        errors: [],
        key: 'b',
        reactId: '/b+undefined',
        address: ['b'],
        required: true,
        valueSchema: { default: 'Barcelona', type: 'string' },
        sortIndex: 3,
        type: 'string',
        value: 'Barcelona',
      },
      {
        errors: [],
        key: 'optList',
        reactId: '/optList+undefined',
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
        errors: [],
        key: 'optEnum',
        reactId: '/optEnum+undefined',
        address: ['optEnum'],
        required: false,
        valueSchema: { type: 'string', enum: ['one', 'two', 'three'] },
        sortIndex: 7,
        type: 'string',
        value: EMPTY_VALUE,
      },
      {
        errors: [],
        key: 'enumObjects',
        reactId: '/enumObjects+undefined',
        address: ['enumObjects'],
        required: false,
        valueSchema: { type: 'object', enum: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        sortIndex: 9,
        type: 'object',
        value: EMPTY_VALUE,
      },
      {
        errors: [],
        key: 'enumArrays',
        reactId: '/enumArrays+undefined',
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
        errors: [],
        key: 'enumArraysAndObjects',
        reactId: '/enumArraysAndObjects+undefined',
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
        errors: [],
        key: 'a',
        value: 1,
        reactId: '/a+1',
        address: ['a'],
        required: true,
        valueSchema: { default: 1e10, type: 'number' },
        sortIndex: Number.MIN_SAFE_INTEGER + 1,
        type: 'number',
      },
      {
        errors: [],
        key: 'b',
        reactId: '/b+undefined',
        address: ['b'],
        required: true,
        valueSchema: { default: 'Barcelona', type: 'string' },
        sortIndex: Number.MIN_SAFE_INTEGER + 3,
        type: 'string',
        value: 'Barcelona',
      },
      {
        errors: [],
        key: 'optList',
        reactId: '/optList+undefined',
        address: ['optList'],
        required: false,
        valueSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'number' }, name: { type: 'string' } },
          },
        },
        sortIndex: Number.MIN_SAFE_INTEGER + 5,
        type: 'array',
        value: EMPTY_VALUE,
      },
      {
        errors: [],
        key: 'optEnum',
        reactId: '/optEnum+undefined',
        address: ['optEnum'],
        required: false,
        valueSchema: { type: 'string', enum: ['one', 'two', 'three'] },
        sortIndex: Number.MIN_SAFE_INTEGER + 7,
        type: 'string',
        value: EMPTY_VALUE,
      },
      {
        errors: [],
        key: 'enumObjects',
        reactId: '/enumObjects+undefined',
        address: ['enumObjects'],
        required: false,
        valueSchema: { type: 'object', enum: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        sortIndex: Number.MIN_SAFE_INTEGER + 9,
        type: 'object',
        value: EMPTY_VALUE,
      },
      {
        errors: [],
        key: 'enumArrays',
        reactId: '/enumArrays+undefined',
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
        sortIndex: Number.MIN_SAFE_INTEGER + 11,
        type: 'array',
        value: EMPTY_VALUE,
      },
      {
        errors: [],
        key: 'enumArraysAndObjects',
        reactId: '/enumArraysAndObjects+undefined',
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
        sortIndex: Number.MIN_SAFE_INTEGER + 13,
        type: 'array',
        value: EMPTY_VALUE,
      },
      { errors: [], key: '111', value: 'aaa', reactId: '/111+"aaa"', sortIndex: 0 },
      { errors: [], key: 'd', value: { e: 'f' }, reactId: '/d+{"e":"f"}', sortIndex: 0 },
      { errors: [], key: 'c', value: [1, 2, 3], reactId: '/c+[1,2,3]', sortIndex: 15 },
    ],
  },
]
