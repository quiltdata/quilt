export const schema = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-incorrect.json',
  type: 'object',
  properties: {
    enumBool: {
      type: 'enum',
      enum: [true, false],
    },
  },
}
