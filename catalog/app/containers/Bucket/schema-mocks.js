const initialSchema = {
  type: 'object',
  properties: {
    num: {
      type: 'number',
    },
    more: {
      type: 'string',
      enum: ['one', 'two', 'three'],
    },
    user_meta: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        ppu: { type: 'number' },
        batters: {
          type: 'object',
          properties: {
            batter: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['id', 'type', 'name', 'ppu', 'batters'],
    },
    message: {
      type: 'string',
    },
    version: {
      type: 'string',
    },
  },
  required: ['version', 'message', 'user_meta'],
}

const invalidSchema = {
  type: 'object',
  properties: {
    a: {
      type: 'number',
    },
    b: {
      type: 'string',
    },
  },
  required: ['a', 'b'],
}

const option1 = {
  isDefault: false,
  schema: invalidSchema,
  slug: 'schema-1',
  title: 'Schema 1',
}

const option2 = {
  isDefault: true,
  schema: initialSchema,
  slug: 'schema-2',
  title: 'Schema 2',
}

export default [option1, option2]
