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
  '/longNestedList/__*': {
    address: ['longNestedList', '__*'],
    required: false,
    sortIndex: 2,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          items: {
            items: {
              items: {
                items: {
                  items: {
                    items: {
                      items: {
                        type: 'number',
                      },
                      type: 'array',
                    },
                    type: 'array',
                  },
                  type: 'array',
                },
                type: 'array',
              },
              type: 'array',
            },
            type: 'array',
          },
          type: 'array',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*': {
    address: ['longNestedList', '__*', '__*'],
    required: false,
    sortIndex: 3,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          items: {
            items: {
              items: {
                items: {
                  items: {
                    items: {
                      type: 'number',
                    },
                    type: 'array',
                  },
                  type: 'array',
                },
                type: 'array',
              },
              type: 'array',
            },
            type: 'array',
          },
          type: 'array',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*': {
    address: ['longNestedList', '__*', '__*', '__*'],
    required: false,
    sortIndex: 4,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          items: {
            items: {
              items: {
                items: {
                  items: {
                    type: 'number',
                  },
                  type: 'array',
                },
                type: 'array',
              },
              type: 'array',
            },
            type: 'array',
          },
          type: 'array',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*/__*': {
    address: ['longNestedList', '__*', '__*', '__*', '__*'],
    required: false,
    sortIndex: 5,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          items: {
            items: {
              items: {
                items: {
                  type: 'number',
                },
                type: 'array',
              },
              type: 'array',
            },
            type: 'array',
          },
          type: 'array',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*/__*/__*': {
    address: ['longNestedList', '__*', '__*', '__*', '__*', '__*'],
    required: false,
    sortIndex: 6,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          items: {
            items: {
              items: {
                type: 'number',
              },
              type: 'array',
            },
            type: 'array',
          },
          type: 'array',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*/__*/__*/__*': {
    address: ['longNestedList', '__*', '__*', '__*', '__*', '__*', '__*'],
    required: false,
    sortIndex: 7,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          items: {
            items: {
              type: 'number',
            },
            type: 'array',
          },
          type: 'array',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*/__*/__*/__*/__*': {
    address: ['longNestedList', '__*', '__*', '__*', '__*', '__*', '__*', '__*'],
    required: false,
    sortIndex: 8,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          items: {
            type: 'number',
          },
          type: 'array',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*/__*/__*/__*/__*/__*': {
    address: ['longNestedList', '__*', '__*', '__*', '__*', '__*', '__*', '__*', '__*'],
    required: false,
    sortIndex: 9,
    type: 'array',
    valueSchema: {
      items: {
        items: {
          type: 'number',
        },
        type: 'array',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*/__*/__*/__*/__*/__*/__*': {
    address: [
      'longNestedList',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
    ],
    required: false,
    sortIndex: 10,
    type: 'array',
    valueSchema: {
      items: {
        type: 'number',
      },
      type: 'array',
    },
  },
  '/longNestedList/__*/__*/__*/__*/__*/__*/__*/__*/__*/__*': {
    address: [
      'longNestedList',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
      '__*',
    ],
    required: false,
    sortIndex: 11,
    type: 'number',
    valueSchema: {
      type: 'number',
    },
  },
}
