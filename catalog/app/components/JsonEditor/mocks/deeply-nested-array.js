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

export const jsonDict = {
  '/longNestedList': {
    address: ['longNestedList'],
    required: false,
    valueSchema: {
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
    sortIndex: 1,
    type: 'array',
  },
}
