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
