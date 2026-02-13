import type { IntrospectionQuery } from 'graphql'

export default {
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
        kind: 'OBJECT',
        name: 'APIKey',
        fields: [
          {
            name: 'id',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
            args: [],
          },
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
            name: 'fingerprint',
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
            name: 'createdAt',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'expiresAt',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'lastUsedAt',
            type: {
              kind: 'SCALAR',
              name: 'Datetime',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'userEmail',
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
            name: 'status',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Any',
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'SCALAR',
        name: 'ID',
      },
      {
        kind: 'SCALAR',
        name: 'String',
      },
      {
        kind: 'OBJECT',
        name: 'APIKeyAdminMutations',
        fields: [
          {
            name: 'revoke',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'APIKeyRevokeResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
        name: 'APIKeyAdminQueries',
        fields: [
          {
            name: 'list',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'APIKey',
                    ofType: null,
                  },
                },
              },
            },
            args: [
              {
                name: 'email',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              {
                name: 'name',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              {
                name: 'fingerprint',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              {
                name: 'status',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
          {
            name: 'get',
            type: {
              kind: 'OBJECT',
              name: 'APIKey',
              ofType: null,
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
        kind: 'SCALAR',
        name: 'Int',
      },
      {
        kind: 'UNION',
        name: 'APIKeyCreateResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'APIKeyCreated',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'APIKeyCreated',
        fields: [
          {
            name: 'apiKey',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'APIKey',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'secret',
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
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'APIKeyRevokeResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Ok',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'AccessCountForDate',
        fields: [
          {
            name: 'date',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'value',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'AccessCounts',
        fields: [
          {
            name: 'total',
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
            name: 'counts',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'AccessCountForDate',
                    ofType: null,
                  },
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
        name: 'AccessCountsGroup',
        fields: [
          {
            name: 'ext',
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
            name: 'counts',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'AccessCounts',
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
        name: 'AdminMutations',
        fields: [
          {
            name: 'user',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'UserAdminMutations',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'setSsoConfig',
            type: {
              kind: 'UNION',
              name: 'SetSsoConfigResult',
              ofType: null,
            },
            args: [
              {
                name: 'config',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'bucketSetTabulatorTable',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BucketSetTabulatorTableResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'bucketName',
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
                name: 'tableName',
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
                name: 'config',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'bucketRenameTabulatorTable',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BucketSetTabulatorTableResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'bucketName',
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
                name: 'tableName',
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
                name: 'newTableName',
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
          {
            name: 'setTabulatorOpenQuery',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'TabulatorOpenQueryResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'enabled',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'packager',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'PackagerAdminMutations',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'apiKeys',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'APIKeyAdminMutations',
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
        name: 'Boolean',
      },
      {
        kind: 'OBJECT',
        name: 'AdminQueries',
        fields: [
          {
            name: 'user',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'UserAdminQueries',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'ssoConfig',
            type: {
              kind: 'OBJECT',
              name: 'SsoConfig',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'isDefaultRoleSettingDisabled',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'tabulatorOpenQuery',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'packager',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'PackagerAdminQueries',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'apiKeys',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'APIKeyAdminQueries',
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
        name: 'BooleanPackageUserMetaFacet',
        fields: [
          {
            name: 'path',
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
        ],
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'IPackageUserMetaFacet',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'BrowsingSession',
        fields: [
          {
            name: 'id',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'expires',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'BrowsingSessionCreateResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BrowsingSession',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'BrowsingSessionDisposeResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Ok',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'BrowsingSessionRefreshResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BrowsingSession',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'BucketAccessCounts',
        fields: [
          {
            name: 'byExt',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'AccessCountsGroup',
                    ofType: null,
                  },
                },
              },
            },
            args: [
              {
                name: 'groups',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'combined',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'AccessCounts',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
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
            name: 'BucketFileExtensionsToIndexInvalid',
          },
          {
            kind: 'OBJECT',
            name: 'BucketIndexContentBytesInvalid',
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
          {
            kind: 'OBJECT',
            name: 'SubscriptionInvalid',
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
            name: 'browsable',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
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
          {
            name: 'indexContentBytes',
            type: {
              kind: 'SCALAR',
              name: 'Int',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'prefixes',
            type: {
              kind: 'NON_NULL',
              ofType: {
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
            },
            args: [],
          },
          {
            name: 'associatedPolicies',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'PolicyBucketPermission',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'associatedRoles',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'RoleBucketPermission',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'collaborators',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'CollaboratorBucketConnection',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'tabulatorTables',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'TabulatorTable',
                    ofType: null,
                  },
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
        name: 'BucketFileExtensionsToIndexInvalid',
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
        name: 'BucketIndexContentBytesInvalid',
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
        kind: 'INTERFACE',
        name: 'BucketPermission',
        fields: [
          {
            name: 'bucket',
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
          {
            name: 'level',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Any',
              },
            },
            args: [],
          },
        ],
        interfaces: [],
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PolicyBucketPermission',
          },
          {
            kind: 'OBJECT',
            name: 'RoleBucketPermission',
          },
        ],
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
        name: 'BucketSetTabulatorTableResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BucketConfig',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
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
            name: 'BucketFileExtensionsToIndexInvalid',
          },
          {
            kind: 'OBJECT',
            name: 'BucketIndexContentBytesInvalid',
          },
          {
            kind: 'OBJECT',
            name: 'BucketNotFound',
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
        kind: 'OBJECT',
        name: 'Canary',
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
            name: 'region',
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
            name: 'group',
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
            name: 'description',
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
            name: 'schedule',
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
            name: 'ok',
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'lastRun',
            type: {
              kind: 'SCALAR',
              name: 'Datetime',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'Collaborator',
        fields: [
          {
            name: 'email',
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
            name: 'username',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'CollaboratorBucketConnection',
        fields: [
          {
            name: 'collaborator',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'Collaborator',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'permissionLevel',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Any',
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'Config',
        fields: [
          {
            name: 'contentIndexingSettings',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'ContentIndexingSettings',
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
        name: 'ContentIndexingSettings',
        fields: [
          {
            name: 'extensions',
            type: {
              kind: 'NON_NULL',
              ofType: {
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
            },
            args: [],
          },
          {
            name: 'bytesDefault',
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
            name: 'bytesMin',
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
            name: 'bytesMax',
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
        ],
        interfaces: [],
      },
      {
        kind: 'SCALAR',
        name: 'Datetime',
      },
      {
        kind: 'OBJECT',
        name: 'DatetimeExtents',
        fields: [
          {
            name: 'min',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'max',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
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
        name: 'DatetimePackageUserMetaFacet',
        fields: [
          {
            name: 'path',
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
            name: 'extents',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'DatetimeExtents',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'IPackageUserMetaFacet',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'EmptySearchResultSet',
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
        kind: 'INTERFACE',
        name: 'IPackageUserMetaFacet',
        fields: [
          {
            name: 'path',
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
        ],
        interfaces: [],
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BooleanPackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'DatetimePackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'KeywordPackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'NumberPackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'TextPackageUserMetaFacet',
          },
        ],
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
        name: 'InputError',
        fields: [
          {
            name: 'path',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'message',
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
            name: 'context',
            type: {
              kind: 'SCALAR',
              name: 'JsonRecord',
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
            name: 'message',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'InvalidInput',
        fields: [
          {
            name: 'errors',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'InputError',
                    ofType: null,
                  },
                },
              },
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
        kind: 'SCALAR',
        name: 'JsonRecord',
      },
      {
        kind: 'OBJECT',
        name: 'KeywordExtents',
        fields: [
          {
            name: 'values',
            type: {
              kind: 'NON_NULL',
              ofType: {
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
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'KeywordPackageUserMetaFacet',
        fields: [
          {
            name: 'path',
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
            name: 'extents',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'KeywordExtents',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'IPackageUserMetaFacet',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'ManagedRole',
        fields: [
          {
            name: 'id',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
            args: [],
          },
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
            name: 'arn',
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
            name: 'policies',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'Policy',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'permissions',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'RoleBucketPermission',
                    ofType: null,
                  },
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
        name: 'Me',
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
            name: 'email',
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
            name: 'isAdmin',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'role',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'MyRole',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'roles',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'MyRole',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'apiKeys',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'APIKey',
                    ofType: null,
                  },
                },
              },
            },
            args: [
              {
                name: 'name',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              {
                name: 'fingerprint',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              {
                name: 'status',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
          {
            name: 'apiKey',
            type: {
              kind: 'OBJECT',
              name: 'APIKey',
              ofType: null,
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
        name: 'MutateUserAdminMutations',
        fields: [
          {
            name: 'delete',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'OperationResult',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'setEmail',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'UserResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'email',
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
          {
            name: 'setRole',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'UserResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'role',
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
                name: 'extraRoles',
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
              },
              {
                name: 'append',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'addRoles',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'UserResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'roles',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
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
                },
              },
            ],
          },
          {
            name: 'removeRoles',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'UserResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'roles',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
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
                },
              },
              {
                name: 'fallback',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'setAdmin',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'UserResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'admin',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'setActive',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'UserResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'active',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'resetPassword',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'OperationResult',
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
        name: 'Mutation',
        fields: [
          {
            name: 'switchRole',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'SwitchRoleResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'roleName',
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
          {
            name: 'apiKeyCreate',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'APIKeyCreateResult',
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
            name: 'apiKeyRevoke',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'APIKeyRevokeResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'SCALAR',
                  name: 'ID',
                  ofType: null,
                },
              },
              {
                name: 'secret',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'packageConstruct',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PackageConstructResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'params',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Any',
                  },
                },
              },
              {
                name: 'src',
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
            name: 'packagePromote',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PackagePromoteResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'params',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Any',
                  },
                },
              },
              {
                name: 'src',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Any',
                  },
                },
              },
              {
                name: 'destPrefix',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'packageRevisionDelete',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PackageRevisionDeleteResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'bucket',
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
                name: 'hash',
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
          {
            name: 'admin',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'AdminMutations',
                ofType: null,
              },
            },
            args: [],
          },
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
          {
            name: 'bucketSetTabulatorTable',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BucketSetTabulatorTableResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'bucketName',
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
                name: 'tableName',
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
                name: 'config',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'bucketRenameTabulatorTable',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BucketSetTabulatorTableResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'bucketName',
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
                name: 'tableName',
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
                name: 'newTableName',
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
          {
            name: 'policyCreateManaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PolicyResult',
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
            name: 'policyCreateUnmanaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PolicyResult',
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
            name: 'policyUpdateManaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PolicyResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
            name: 'policyUpdateUnmanaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PolicyResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
            name: 'policyDelete',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PolicyDeleteResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'roleCreateManaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'RoleCreateResult',
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
            name: 'roleCreateUnmanaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'RoleCreateResult',
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
            name: 'roleUpdateManaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'RoleUpdateResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
            name: 'roleUpdateUnmanaged',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'RoleUpdateResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
            name: 'roleDelete',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'RoleDeleteResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'roleSetDefault',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'RoleSetDefaultResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'browsingSessionCreate',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BrowsingSessionCreateResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'scope',
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
                name: 'ttl',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'browsingSessionRefresh',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BrowsingSessionRefreshResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
              {
                name: 'ttl',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'browsingSessionDispose',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'BrowsingSessionDisposeResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
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
        name: 'MyRole',
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
        name: 'NumberExtents',
        fields: [
          {
            name: 'min',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'max',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
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
        name: 'Float',
      },
      {
        kind: 'OBJECT',
        name: 'NumberPackageUserMetaFacet',
        fields: [
          {
            name: 'path',
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
            name: 'extents',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'NumberExtents',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'IPackageUserMetaFacet',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'ObjectsSearchMoreResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'ObjectsSearchResultSetPage',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'ObjectsSearchResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'ObjectsSearchResultSet',
          },
          {
            kind: 'OBJECT',
            name: 'EmptySearchResultSet',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'ObjectsSearchResultSet',
        fields: [
          {
            name: 'total',
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
            name: 'stats',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'ObjectsSearchStats',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'firstPage',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'ObjectsSearchResultSetPage',
                ofType: null,
              },
            },
            args: [
              {
                name: 'size',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
              {
                name: 'order',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'ObjectsSearchResultSetPage',
        fields: [
          {
            name: 'cursor',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'hits',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'SearchHitObject',
                    ofType: null,
                  },
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
        name: 'ObjectsSearchStats',
        fields: [
          {
            name: 'modified',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'DatetimeExtents',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'size',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'NumberExtents',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'ext',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'KeywordExtents',
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
        name: 'Ok',
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
        name: 'OperationError',
        fields: [
          {
            name: 'message',
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
            name: 'context',
            type: {
              kind: 'SCALAR',
              name: 'JsonRecord',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'OperationResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Ok',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'Package',
        fields: [
          {
            name: 'bucket',
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
            name: 'modified',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'revisions',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'PackageRevisionList',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'revision',
            type: {
              kind: 'OBJECT',
              name: 'PackageRevision',
              ofType: null,
            },
            args: [
              {
                name: 'hashOrTag',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'accessCounts',
            type: {
              kind: 'OBJECT',
              name: 'AccessCounts',
              ofType: null,
            },
            args: [
              {
                name: 'window',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'PackageConstructResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PackagePushSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'SCALAR',
        name: 'PackageContentsFlatMap',
      },
      {
        kind: 'OBJECT',
        name: 'PackageDir',
        fields: [
          {
            name: 'path',
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
            name: 'metadata',
            type: {
              kind: 'SCALAR',
              name: 'JsonRecord',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'size',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'children',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'UNION',
                    name: 'PackageEntry',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'PackageEntry',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PackageFile',
          },
          {
            kind: 'OBJECT',
            name: 'PackageDir',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'PackageFile',
        fields: [
          {
            name: 'path',
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
            name: 'metadata',
            type: {
              kind: 'SCALAR',
              name: 'JsonRecord',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'size',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'physicalKey',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'PackageList',
        fields: [
          {
            name: 'total',
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
            name: 'page',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'Package',
                    ofType: null,
                  },
                },
              },
            },
            args: [
              {
                name: 'number',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
              {
                name: 'perPage',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
              {
                name: 'order',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'PackagePromoteResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PackagePushSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'PackagePushSuccess',
        fields: [
          {
            name: 'package',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'Package',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'revision',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'PackageRevision',
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
        name: 'PackageRevision',
        fields: [
          {
            name: 'hash',
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
            name: 'modified',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'message',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'metadata',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'JsonRecord',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'userMeta',
            type: {
              kind: 'SCALAR',
              name: 'JsonRecord',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'workflow',
            type: {
              kind: 'OBJECT',
              name: 'PackageWorkflow',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'totalEntries',
            type: {
              kind: 'SCALAR',
              name: 'Int',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'totalBytes',
            type: {
              kind: 'SCALAR',
              name: 'Float',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'dir',
            type: {
              kind: 'OBJECT',
              name: 'PackageDir',
              ofType: null,
            },
            args: [
              {
                name: 'path',
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
          {
            name: 'file',
            type: {
              kind: 'OBJECT',
              name: 'PackageFile',
              ofType: null,
            },
            args: [
              {
                name: 'path',
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
          {
            name: 'accessCounts',
            type: {
              kind: 'OBJECT',
              name: 'AccessCounts',
              ofType: null,
            },
            args: [
              {
                name: 'window',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'contentsFlatMap',
            type: {
              kind: 'SCALAR',
              name: 'PackageContentsFlatMap',
              ofType: null,
            },
            args: [
              {
                name: 'max',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'PackageRevisionDeleteResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PackageRevisionDeleteSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'PackageRevisionDeleteSuccess',
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
        name: 'PackageRevisionList',
        fields: [
          {
            name: 'total',
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
            name: 'page',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'PackageRevision',
                    ofType: null,
                  },
                },
              },
            },
            args: [
              {
                name: 'number',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
              {
                name: 'perPage',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'PackageUserMetaFacet',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'NumberPackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'DatetimePackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'KeywordPackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'TextPackageUserMetaFacet',
          },
          {
            kind: 'OBJECT',
            name: 'BooleanPackageUserMetaFacet',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'PackageWorkflow',
        fields: [
          {
            name: 'config',
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
            name: 'id',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'PackagerAdminMutations',
        fields: [
          {
            name: 'toggleEventRule',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PackagerEventRuleToggleResult',
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
                name: 'enabled',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Boolean',
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
        name: 'PackagerAdminQueries',
        fields: [
          {
            name: 'eventRules',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'PackagerEventRule',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'eventRule',
            type: {
              kind: 'OBJECT',
              name: 'PackagerEventRule',
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
        name: 'PackagerEventRule',
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
            name: 'enabled',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'PackagerEventRuleToggleResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PackagerEventRule',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'PackagesSearchMoreResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PackagesSearchResultSetPage',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'PackagesSearchResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'PackagesSearchResultSet',
          },
          {
            kind: 'OBJECT',
            name: 'EmptySearchResultSet',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'PackagesSearchResultSet',
        fields: [
          {
            name: 'total',
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
            name: 'stats',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'PackagesSearchStats',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'filteredUserMetaFacets',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'UNION',
                    name: 'PackageUserMetaFacet',
                    ofType: null,
                  },
                },
              },
            },
            args: [
              {
                name: 'path',
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
                name: 'type',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
          {
            name: 'firstPage',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'PackagesSearchResultSetPage',
                ofType: null,
              },
            },
            args: [
              {
                name: 'size',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
              {
                name: 'order',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'PackagesSearchResultSetPage',
        fields: [
          {
            name: 'cursor',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'hits',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'SearchHitPackage',
                    ofType: null,
                  },
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
        name: 'PackagesSearchStats',
        fields: [
          {
            name: 'modified',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'DatetimeExtents',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'size',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'NumberExtents',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'entries',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'NumberExtents',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'workflow',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'KeywordExtents',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'userMeta',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'UNION',
                    name: 'PackageUserMetaFacet',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'userMetaTruncated',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
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
        name: 'Policy',
        fields: [
          {
            name: 'id',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
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
            name: 'arn',
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
            name: 'managed',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'permissions',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'PolicyBucketPermission',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'roles',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'ManagedRole',
                    ofType: null,
                  },
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
        name: 'PolicyBucketPermission',
        fields: [
          {
            name: 'policy',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'Policy',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'bucket',
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
          {
            name: 'level',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Any',
              },
            },
            args: [],
          },
        ],
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'BucketPermission',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'PolicyDeleteResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Ok',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'PolicyResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Policy',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'Query',
        fields: [
          {
            name: 'me',
            type: {
              kind: 'OBJECT',
              name: 'Me',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'config',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'Config',
                ofType: null,
              },
            },
            args: [],
          },
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
          {
            name: 'potentialCollaborators',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'Collaborator',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'packages',
            type: {
              kind: 'OBJECT',
              name: 'PackageList',
              ofType: null,
            },
            args: [
              {
                name: 'bucket',
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
                name: 'filter',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'package',
            type: {
              kind: 'OBJECT',
              name: 'Package',
              ofType: null,
            },
            args: [
              {
                name: 'bucket',
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
          {
            name: 'searchObjects',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'ObjectsSearchResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'buckets',
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
              },
              {
                name: 'searchString',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              {
                name: 'filter',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
          {
            name: 'searchPackages',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PackagesSearchResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'buckets',
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
              },
              {
                name: 'searchString',
                type: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              {
                name: 'filter',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
              {
                name: 'userMetaFilters',
                type: {
                  kind: 'LIST',
                  ofType: {
                    kind: 'NON_NULL',
                    ofType: {
                      kind: 'SCALAR',
                      name: 'Any',
                    },
                  },
                },
              },
              {
                name: 'latestOnly',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Boolean',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'searchMoreObjects',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'ObjectsSearchMoreResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'after',
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
                name: 'size',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'searchMorePackages',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PackagesSearchMoreResult',
                ofType: null,
              },
            },
            args: [
              {
                name: 'after',
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
                name: 'size',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'subscription',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'SubscriptionState',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'bucketAccessCounts',
            type: {
              kind: 'OBJECT',
              name: 'BucketAccessCounts',
              ofType: null,
            },
            args: [
              {
                name: 'bucket',
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
                name: 'window',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'objectAccessCounts',
            type: {
              kind: 'OBJECT',
              name: 'AccessCounts',
              ofType: null,
            },
            args: [
              {
                name: 'bucket',
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
                name: 'key',
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
                name: 'window',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'admin',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'AdminQueries',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'policies',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'Policy',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'policy',
            type: {
              kind: 'OBJECT',
              name: 'Policy',
              ofType: null,
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'roles',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'UNION',
                    name: 'Role',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'role',
            type: {
              kind: 'UNION',
              name: 'Role',
              ofType: null,
            },
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
            ],
          },
          {
            name: 'defaultRole',
            type: {
              kind: 'UNION',
              name: 'Role',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'status',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'StatusResult',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'Role',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'UnmanagedRole',
          },
          {
            kind: 'OBJECT',
            name: 'ManagedRole',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'RoleAssigned',
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
        name: 'RoleBucketPermission',
        fields: [
          {
            name: 'role',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'Role',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'bucket',
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
          {
            name: 'level',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Any',
              },
            },
            args: [],
          },
        ],
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'BucketPermission',
          },
        ],
      },
      {
        kind: 'UNION',
        name: 'RoleCreateResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'RoleCreateSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameReserved',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameExists',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameInvalid',
          },
          {
            kind: 'OBJECT',
            name: 'RoleHasTooManyPoliciesToAttach',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'RoleCreateSuccess',
        fields: [
          {
            name: 'role',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'Role',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'RoleDeleteResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'RoleDeleteSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'RoleDoesNotExist',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameReserved',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameUsedBySsoConfig',
          },
          {
            kind: 'OBJECT',
            name: 'RoleAssigned',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'RoleDeleteSuccess',
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
        name: 'RoleDoesNotExist',
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
        name: 'RoleHasTooManyPoliciesToAttach',
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
        name: 'RoleIsManaged',
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
        name: 'RoleIsUnmanaged',
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
        name: 'RoleNameExists',
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
        name: 'RoleNameInvalid',
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
        name: 'RoleNameReserved',
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
        name: 'RoleNameUsedBySsoConfig',
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
        name: 'RoleSetDefaultResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'RoleSetDefaultSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'RoleDoesNotExist',
          },
          {
            kind: 'OBJECT',
            name: 'SsoConfigConflict',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'RoleSetDefaultSuccess',
        fields: [
          {
            name: 'role',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'Role',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'RoleUpdateResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'RoleUpdateSuccess',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameReserved',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameExists',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameInvalid',
          },
          {
            kind: 'OBJECT',
            name: 'RoleNameUsedBySsoConfig',
          },
          {
            kind: 'OBJECT',
            name: 'RoleIsManaged',
          },
          {
            kind: 'OBJECT',
            name: 'RoleIsUnmanaged',
          },
          {
            kind: 'OBJECT',
            name: 'RoleHasTooManyPoliciesToAttach',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'RoleUpdateSuccess',
        fields: [
          {
            name: 'role',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'Role',
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
        name: 'S3ObjectLocation',
      },
      {
        kind: 'OBJECT',
        name: 'SearchHitObject',
        fields: [
          {
            name: 'id',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'score',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'bucket',
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
            name: 'key',
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
            name: 'version',
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
            name: 'size',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'modified',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'deleted',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'indexedContent',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'SearchHitPackage',
        fields: [
          {
            name: 'id',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'score',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'bucket',
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
            name: 'pointer',
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
            name: 'hash',
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
            name: 'size',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'modified',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'totalEntriesCount',
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
            name: 'comment',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'meta',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'workflow',
            type: {
              kind: 'SCALAR',
              name: 'JsonRecord',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'matchLocations',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'SearchHitPackageMatchLocations',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'matchingEntries',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'SearchHitPackageMatchingEntry',
                    ofType: null,
                  },
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
        name: 'SearchHitPackageEntryMatchLocations',
        fields: [
          {
            name: 'logicalKey',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'physicalKey',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'meta',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'contents',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
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
        name: 'SearchHitPackageMatchLocations',
        fields: [
          {
            name: 'name',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'comment',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'meta',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'workflow',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
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
        name: 'SearchHitPackageMatchingEntry',
        fields: [
          {
            name: 'logicalKey',
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
            name: 'physicalKey',
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
            name: 'size',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Float',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'meta',
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'matchLocations',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'SearchHitPackageEntryMatchLocations',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'SetSsoConfigResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'SsoConfig',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
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
        kind: 'OBJECT',
        name: 'SsoConfig',
        fields: [
          {
            name: 'text',
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
            name: 'timestamp',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'uploader',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'User',
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
        name: 'SsoConfigConflict',
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
        name: 'Status',
        fields: [
          {
            name: 'canaries',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'Canary',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'latestStats',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'TestStats',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'stats',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'TestStatsTimeSeries',
                ofType: null,
              },
            },
            args: [
              {
                name: 'window',
                type: {
                  kind: 'SCALAR',
                  name: 'Int',
                  ofType: null,
                },
              },
            ],
          },
          {
            name: 'reports',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'OBJECT',
                name: 'StatusReportList',
                ofType: null,
              },
            },
            args: [
              {
                name: 'filter',
                type: {
                  kind: 'SCALAR',
                  name: 'Any',
                },
              },
            ],
          },
          {
            name: 'reportsBucket',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'StatusReport',
        fields: [
          {
            name: 'timestamp',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'renderedReportLocation',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'S3ObjectLocation',
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
        name: 'StatusReportList',
        fields: [
          {
            name: 'total',
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
            name: 'page',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'StatusReport',
                    ofType: null,
                  },
                },
              },
            },
            args: [
              {
                name: 'number',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                },
              },
              {
                name: 'perPage',
                type: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                },
              },
              {
                name: 'order',
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
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'StatusResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Status',
          },
          {
            kind: 'OBJECT',
            name: 'Unavailable',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'SubscriptionInvalid',
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
        name: 'SubscriptionState',
        fields: [
          {
            name: 'active',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'timestamp',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
        ],
        interfaces: [],
      },
      {
        kind: 'UNION',
        name: 'SwitchRoleResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Me',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'TabulatorOpenQueryResult',
        fields: [
          {
            name: 'tabulatorOpenQuery',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
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
        name: 'TabulatorTable',
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
            name: 'config',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'TestStats',
        fields: [
          {
            name: 'passed',
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
            name: 'failed',
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
            name: 'running',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'TestStatsTimeSeries',
        fields: [
          {
            name: 'datetimes',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Datetime',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'passed',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'failed',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'SCALAR',
                    name: 'Int',
                    ofType: null,
                  },
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
        name: 'TextPackageUserMetaFacet',
        fields: [
          {
            name: 'path',
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
        ],
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'IPackageUserMetaFacet',
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'Unavailable',
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
        name: 'UnmanagedRole',
        fields: [
          {
            name: 'id',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
            args: [],
          },
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
            name: 'arn',
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
        ],
        interfaces: [],
      },
      {
        kind: 'OBJECT',
        name: 'User',
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
            name: 'email',
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
            name: 'dateJoined',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'lastLogin',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Datetime',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'isActive',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'isAdmin',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'isSsoOnly',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'isService',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'role',
            type: {
              kind: 'UNION',
              name: 'Role',
              ofType: null,
            },
            args: [],
          },
          {
            name: 'extraRoles',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'UNION',
                    name: 'Role',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'isRoleAssignmentDisabled',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            args: [],
          },
          {
            name: 'isAdminAssignmentDisabled',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
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
        name: 'UserAdminMutations',
        fields: [
          {
            name: 'create',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'UserResult',
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
            name: 'mutate',
            type: {
              kind: 'OBJECT',
              name: 'MutateUserAdminMutations',
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
        name: 'UserAdminQueries',
        fields: [
          {
            name: 'list',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'LIST',
                ofType: {
                  kind: 'NON_NULL',
                  ofType: {
                    kind: 'OBJECT',
                    name: 'User',
                    ofType: null,
                  },
                },
              },
            },
            args: [],
          },
          {
            name: 'get',
            type: {
              kind: 'OBJECT',
              name: 'User',
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
        kind: 'UNION',
        name: 'UserResult',
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'User',
          },
          {
            kind: 'OBJECT',
            name: 'InvalidInput',
          },
          {
            kind: 'OBJECT',
            name: 'OperationError',
          },
        ],
      },
      {
        kind: 'SCALAR',
        name: 'Any',
      },
    ],
    directives: [],
  },
} as unknown as IntrospectionQuery
