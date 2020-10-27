export const initialSchema = {
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

export const invalidSchema = {
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

export const mockedWorkflows = `
version: 1
is_workflow_required: False
default_workflow: workflow-id1
workflows:
  workflow-id1:  # To be used in API calls
    name: User-provided name for UI/API surfaces (required)
    description: User-provided description for UI/API surfaces (optional)
    metadata_schema: schema-internal-id2
  workflow-id2:
    name: User-provided name for UI/API surfaces
    is_message_required: true
schemas:
 schema-internal-id1:
   url: s3://example/scheme.json
 schema-internal-id2:
   url: s3://example/scheme2.json
 schema-internal-id3:
   url: s3://example/scheme3.json
`
