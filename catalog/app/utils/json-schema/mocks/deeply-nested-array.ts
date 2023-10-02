export const schema = {
  id: 's3://fiskus-sandbox-dev/.quilt/workflows/schema-nested-array.json',
  type: 'object',
  properties: {
    longNestedList: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'array',
          items: {
            type: 'array',
            items: {
              type: 'array',
              items: {
                type: 'array',
                items: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: {
                        type: 'array',
                        items: {
                          type: 'number',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}
