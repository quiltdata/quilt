import { EMPTY_VALUE } from '../State'

export const schema = {
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

export const jsonDict = {
  boolValue: {
    address: ['boolValue'],
    required: false,
    sortIndex: 3,
    type: 'boolean',
    valueSchema: {
      type: 'boolean',
    },
  },
  enumBool: {
    address: ['enumBool'],
    required: false,
    sortIndex: 5,
    type: 'boolean',
    valueSchema: {
      enum: [true, false],
      type: 'boolean',
    },
  },
  nullValue: {
    address: ['nullValue'],
    required: false,
    sortIndex: 1,
    type: 'null',
    valueSchema: {
      type: 'null',
    },
  },
}

export const columns = [
  {
    parent: {},
    items: [
      {
        key: 'nullValue',
        reactId: 'nullValue+undefined',
        address: ['nullValue'],
        required: false,
        valueSchema: {
          type: 'null',
        },
        sortIndex: 1,
        type: 'null',
        value: EMPTY_VALUE,
      },
      {
        key: 'boolValue',
        reactId: 'boolValue+undefined',
        address: ['boolValue'],
        required: false,
        valueSchema: {
          type: 'boolean',
        },
        sortIndex: 3,
        type: 'boolean',
        value: EMPTY_VALUE,
      },
      {
        key: 'enumBool',
        reactId: 'enumBool+undefined',
        address: ['enumBool'],
        required: false,
        valueSchema: {
          type: 'boolean',
          enum: [true, false],
        },
        sortIndex: 5,
        type: 'boolean',
        value: EMPTY_VALUE,
      },
    ],
  },
]
