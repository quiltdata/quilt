const allInOneSchema = {
  type: 'object',
  properties: {
    num: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'string',
        },
      ],
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

const simpleSchema = {
  type: 'object',
  definitions: {
    cDef: {
      type: 'array',
      items: {
        type: 'number',
      },
    },
  },
  properties: {
    a: {
      type: 'number',
    },
    b: {
      type: 'string',
    },
    c: {
      $ref: '#/definitions/cDef',
    },
  },
  required: ['a', 'b'],
}

export const mockedSchemas = {
  's3://example/scheme.json': allInOneSchema,
  's3://example/scheme2.json': simpleSchema,
}

export const mockedWorkflows = `
version: 1
is_workflow_required: False
default_workflow: workflow-id1
workflows:
  workflow-id1:  # To be used in API calls
    name: User-provided name for UI/API surfaces (required)
    description: User-provided description for UI/API surfaces (optional)
    metadata_schema: schema-internal-id1
  workflow-id2:
    name: User-provided name for UI/API surfaces
    is_message_required: true
  workflow-id3:
    name: Schema №1
    metadata_schema: schema-internal-id2
schemas:
 schema-internal-id1:
   url: s3://example/scheme.json
 schema-internal-id2:
   url: s3://example/scheme2.json
 schema-internal-id3:
   url: s3://example/scheme3.json
`
