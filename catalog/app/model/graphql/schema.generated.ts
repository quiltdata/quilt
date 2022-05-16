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
        kind: 'SCALAR',
        name: 'Int',
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
        kind: 'SCALAR',
        name: 'String',
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
        kind: 'SCALAR',
        name: 'ID',
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
        name: 'Mutation',
        fields: [
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
            ],
          },
          {
            name: 'packageFromFolder',
            type: {
              kind: 'NON_NULL',
              ofType: {
                kind: 'UNION',
                name: 'PackageFromFolderResult',
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
        kind: 'SCALAR',
        name: 'Float',
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
        kind: 'UNION',
        name: 'PackageFromFolderResult',
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
        kind: 'SCALAR',
        name: 'Any',
      },
    ],
    directives: [],
  },
} as unknown as IntrospectionQuery
