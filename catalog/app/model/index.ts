import * as IO from 'io-ts'
import * as Types from 'io-ts-types'

// TODO: move reusable helpers out of here
export interface NullableC<C extends IO.Mixed>
  extends IO.Type<IO.TypeOf<C> | null, IO.OutputOf<C> | null, unknown> {}

export type Nullable<T> = T | null

export function nullable<C extends IO.Mixed>(
  codec: C,
  name: string = `Nullable<${codec.name}>`,
): NullableC<C> {
  return new IO.Type(
    name,
    (i): i is Nullable<IO.TypeOf<C>> => i === null || codec.is(i),
    (u, c) => (u == null ? IO.success(null) : codec.validate(u, c)),
    (a) => a,
  )
}

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
    iconUrl: nullable(IO.string),
    description: nullable(IO.string),
    relevanceScore: IO.Int,
    overviewUrl: nullable(IO.string),
    tags: nullable(IO.array(IO.string)),
    linkedData: nullable(BucketLinkedData),
    fileExtensionsToIndex: nullable(IO.array(IO.string)),
    scannerParallelShardsDepth: nullable(IO.Int),
    snsNotificationArn: nullable(IO.string),
    skipMetaDataIndexing: nullable(IO.boolean),
    lastIndexed: nullable(Types.date),
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
    iconUrl: nullable(Types.NonEmptyString),
    description: nullable(Types.NonEmptyString),
    linkedData: nullable(BucketLinkedData),
    overviewUrl: nullable(Types.NonEmptyString),
    tags: nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    relevanceScore: nullable(IO.Int),
    snsNotificationArn: nullable(Types.NonEmptyString), // TODO: use arn type?
    scannerParallelShardsDepth: nullable(IO.Int),
    skipMetaDataIndexing: IO.boolean,
    fileExtensionsToIndex: nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    setVersioning: nullable(IO.boolean),
    delayScan: nullable(IO.boolean),
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
    iconUrl: nullable(Types.NonEmptyString),
    description: nullable(Types.NonEmptyString),
    linkedData: nullable(BucketLinkedData),
    overviewUrl: nullable(Types.NonEmptyString),
    tags: nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    relevanceScore: nullable(IO.Int),
    snsNotificationArn: nullable(Types.NonEmptyString), // TODO: use arn type?
    scannerParallelShardsDepth: nullable(IO.Int),
    skipMetaDataIndexing: IO.boolean,
    fileExtensionsToIndex: nullable(Types.nonEmptyArray(Types.NonEmptyString)),
    setVersioning: nullable(IO.boolean),
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
