import type { IntrospectionQuery } from 'graphql'

export default ({
  __schema: {
    queryType: {
      name: 'Query',
    },
    mutationType: {
      name: 'Mutation',
    },
    subscriptionType: null,
    types: [
      {
        kind: 'SCALAR',
        name: 'String',
      },
      {
        kind: 'SCALAR',
        name: 'Int',
      },
      {
        kind: 'SCALAR',
        name: 'Boolean',
      },
      {
        kind: 'UNION',
        name: 'BucketAddResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BucketAddSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'BucketAlreadyAdded',
          },
          {
            kind: 'OBJECT',
            name: 'BucketDoesNotExist',
          },
          {
            kind: 'OBJECT',
            name: 'InsufficientPermissions',
          },
          {
            kind: 'OBJECT',
            name: 'NotificationConfigurationError',
          },
          {
            kind: 'OBJECT',
            name: 'NotificationTopicNotFound',
          },
          {
            kind: 'OBJECT',
            name: 'SnsInvalid',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'BucketAddSuccess',
        fields: [
          {
            name: 'bucketConfig',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'BucketConfig',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'BucketAlreadyAdded',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'BucketConfig',
        fields: [
          {
            name: 'name',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'title',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'iconUrl',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'description',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'linkedData',
            type: {
              kind: 'SCALAR',
              name: 'Json',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'overviewUrl',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'tags',
            type: {
              kind: 'LIST',
              ofType: {
                kind: 'NON_NULL',
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            },
            args: [],
          },
          {
            name: 'relevanceScore',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Int',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'lastIndexed',
            type: {
              kind: 'SCALAR',
              name: 'Datetime',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'snsNotificationArn',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'scannerParallelShardsDepth',
            type: {
              kind: 'SCALAR',
              name: 'Int',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'skipMetaDataIndexing',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'fileExtensionsToIndex',
            type: {
              kind: 'LIST',
              ofType: {
                kind: 'NON_NULL',
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'BucketDoesNotExist',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'BucketNotFound',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'BucketRemoveResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BucketRemoveSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'BucketNotFound',
          },
          {
            kind: 'OBJECT',
            name: 'IndexingInProgress',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'BucketRemoveSuccess',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'BucketUpdateResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BucketUpdateSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'BucketNotFound',
          },
          {
            kind: 'OBJECT',
            name: 'NotificationConfigurationError',
          },
          {
            kind: 'OBJECT',
            name: 'NotificationTopicNotFound',
          },
          {
            kind: 'OBJECT',
            name: 'SnsInvalid',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'BucketUpdateSuccess',
        fields: [
          {
            name: 'bucketConfig',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'BucketConfig',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'SCALAR',
        name: 'Datetime',
      },
      {
        kind: 'OBJECT',
        name: 'IndexingInProgress',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'InsufficientPermissions',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'SCALAR',
        name: 'Json',
      },
      {
        kind: 'OBJECT',
        name: 'Mutation',
        fields: [
          {
            name: 'bucketAdd',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BucketAddResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'input',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Any',
                  },
                },
              },
            ],
          },
          {
            name: 'bucketUpdate',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BucketUpdateResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'name',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
              {
                name: 'input',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Any',
                  },
                },
              },
            ],
          },
          {
            name: 'bucketRemove',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BucketRemoveResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'name',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'NotificationConfigurationError',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'NotificationTopicNotFound',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'Query',
        fields: [
          {
            name: 'bucketConfigs',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'BucketConfig',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'bucketConfig',
            type: {
              kind: 'OBJECT',
              name: 'BucketConfig',
              ofType: null,
            },
            args: [
              {
                name: 'name',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'String',
                    ofType: null,
                  },
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'SnsInvalid',
        fields: [
          {
            name: '_',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'SCALAR',
        name: 'Any',
      },
    ],
    directives: [],
  },
} as unknown) as IntrospectionQuery
