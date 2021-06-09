import * as IO from 'io-ts'

import * as Types from 'utils/types'

// XXX: consider modularizing this file
// default bucket icon as returned by the registry
export const DEFAULT_BUCKET_ICON =
  'https://d1zvn9rasera71.cloudfront.net/q-128-square.png'

export const BucketLinkedData = IO.partial(
  {
    name: IO.string,
    description: IO.string,
    sameAs: IO.string,
    identifier: IO.string,
    keywords: IO.array(IO.string),
    creator: IO.string,
    license: IO.string,
  },
  'BucketLinkedData',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketLinkedData = IO.TypeOf<typeof BucketLinkedData>

export const BucketConfig = IO.type(
  {
    name: Types.NonEmptyString,
    title: Types.NonEmptyString,
    iconUrl: Types.nullable(IO.string),
    description: Types.nullable(IO.string),
    relevanceScore: IO.Int,
    overviewUrl: Types.nullable(IO.string),
    tags: Types.nullable(IO.array(IO.string)),
    linkedData: Types.nullable(BucketLinkedData),
    fileExtensionsToIndex: Types.nullable(IO.array(IO.string)),
    scannerParallelShardsDepth: Types.nullable(IO.Int),
    snsNotificationArn: Types.nullable(IO.string),
    skipMetaDataIndexing: Types.nullable(IO.boolean),
    lastIndexed: Types.nullable(Types.date),
  },
  'BucketConfig',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketConfig = IO.TypeOf<typeof BucketConfig>

export const Unauthorized = IO.type(
  { __typename: IO.literal('Unauthorized') },
  'Unauthorized',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Unauthorized = IO.TypeOf<typeof Unauthorized>

export const BucketNotFound = IO.type(
  { __typename: IO.literal('BucketNotFound') },
  'BucketNotFound',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketNotFound = IO.TypeOf<typeof BucketNotFound>

export const SnsInvalid = IO.type({ __typename: IO.literal('SnsInvalid') }, 'SnsInvalid')
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SnsInvalid = IO.TypeOf<typeof SnsInvalid>

export const NotificationConfigurationError = IO.type(
  { __typename: IO.literal('NotificationConfigurationError') },
  'NotificationConfigurationError',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type NotificationConfigurationError = IO.TypeOf<
  typeof NotificationConfigurationError
>

export const NotificationTopicNotFound = IO.type(
  { __typename: IO.literal('NotificationTopicNotFound') },
  'NotificationTopicNotFound',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type NotificationTopicNotFound = IO.TypeOf<typeof NotificationTopicNotFound>

export const BucketAlreadyAdded = IO.type(
  { __typename: IO.literal('BucketAlreadyAdded') },
  'BucketAlreadyAdded',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketAlreadyAdded = IO.TypeOf<typeof BucketAlreadyAdded>

export const BucketDoesNotExist = IO.type(
  { __typename: IO.literal('BucketDoesNotExist') },
  'BucketDoesNotExist',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketDoesNotExist = IO.TypeOf<typeof BucketDoesNotExist>

export const InsufficientPermissions = IO.type(
  { __typename: IO.literal('InsufficientPermissions') },
  'InsufficientPermissions',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type InsufficientPermissions = IO.TypeOf<typeof InsufficientPermissions>

export const IndexingInProgress = IO.type(
  { __typename: IO.literal('IndexingInProgress') },
  'IndexingInProgress',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type IndexingInProgress = IO.TypeOf<typeof IndexingInProgress>

export const BucketAddInput = IO.type(
  {
    name: Types.NonEmptyString,
    title: Types.NonEmptyString,
    iconUrl: Types.nullable(Types.NonEmptyString),
    description: Types.nullable(Types.NonEmptyString),
    linkedData: Types.nullable(BucketLinkedData),
    overviewUrl: Types.nullable(Types.NonEmptyString),
    tags: Types.nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    relevanceScore: Types.nullable(IO.Int),
    snsNotificationArn: Types.nullable(Types.NonEmptyString), // TODO: use arn type?
    scannerParallelShardsDepth: Types.nullable(IO.Int),
    skipMetaDataIndexing: IO.boolean,
    fileExtensionsToIndex: Types.nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    setVersioning: Types.nullable(IO.boolean),
    delayScan: Types.nullable(IO.boolean),
  },
  'BucketAddInput',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketAddInput = IO.TypeOf<typeof BucketAddInput>

export const BucketAddSuccess = IO.type(
  { bucketConfig: BucketConfig },
  'BucketAddSuccess',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketAddSuccess = IO.TypeOf<typeof BucketAddSuccess>

export const BucketAddResult = IO.union(
  [
    BucketAddSuccess,
    BucketAlreadyAdded,
    BucketDoesNotExist,
    InsufficientPermissions,
    NotificationConfigurationError,
    NotificationTopicNotFound,
    SnsInvalid,
    Unauthorized,
  ],
  'BucketAddResult',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketAddResult = IO.TypeOf<typeof BucketAddResult>

export const BucketUpdateInput = IO.type(
  {
    title: Types.NonEmptyString,
    iconUrl: Types.nullable(Types.NonEmptyString),
    description: Types.nullable(Types.NonEmptyString),
    linkedData: Types.nullable(BucketLinkedData),
    overviewUrl: Types.nullable(Types.NonEmptyString),
    tags: Types.nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    relevanceScore: Types.nullable(IO.Int),
    snsNotificationArn: Types.nullable(Types.NonEmptyString), // TODO: use arn type?
    scannerParallelShardsDepth: Types.nullable(IO.Int),
    skipMetaDataIndexing: IO.boolean,
    fileExtensionsToIndex: Types.nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    setVersioning: Types.nullable(IO.boolean),
  },
  'BucketUpdateInput',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketUpdateInput = IO.TypeOf<typeof BucketUpdateInput>

export const BucketUpdateSuccess = IO.type(
  { bucketConfig: BucketConfig },
  'BucketUpdateSuccess',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketUpdateSuccess = IO.TypeOf<typeof BucketUpdateSuccess>

export const BucketUpdateResult = IO.union(
  [
    BucketUpdateSuccess,
    BucketNotFound,
    NotificationConfigurationError,
    NotificationTopicNotFound,
    SnsInvalid,
    Unauthorized,
  ],
  'BucketUpdateResult',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketUpdateResult = IO.TypeOf<typeof BucketUpdateResult>

export const BucketRemoveSuccess = IO.type(
  { __typename: IO.literal('BucketRemoveSuccess') },
  'BucketRemoveSuccess',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketRemoveSuccess = IO.TypeOf<typeof BucketRemoveSuccess>

export const BucketRemoveResult = IO.union(
  [BucketRemoveSuccess, Unauthorized, BucketNotFound, IndexingInProgress],
  'BucketRemoveResult',
)
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BucketRemoveResult = IO.TypeOf<typeof BucketRemoveResult>
