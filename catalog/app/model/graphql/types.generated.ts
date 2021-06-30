import type { Json } from 'utils/types'

export type Maybe<T> = T | null
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]?: Maybe<T[SubKey]> }
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]: Maybe<T[SubKey]> }
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
  Datetime: Date
  Json: Json
}

export interface BucketAddInput {
  readonly name: Scalars['String']
  readonly title: Scalars['String']
  readonly iconUrl: Maybe<Scalars['String']>
  readonly description: Maybe<Scalars['String']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly relevanceScore: Maybe<Scalars['Int']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly setVersioning: Maybe<Scalars['Boolean']>
  readonly delayScan: Maybe<Scalars['Boolean']>
}

export type BucketAddResult =
  | BucketAddSuccess
  | BucketAlreadyAdded
  | BucketDoesNotExist
  | InsufficientPermissions
  | NotificationConfigurationError
  | NotificationTopicNotFound
  | SnsInvalid

export interface BucketAddSuccess {
  readonly __typename: 'BucketAddSuccess'
  readonly bucketConfig: BucketConfig
}

export interface BucketAlreadyAdded {
  readonly __typename: 'BucketAlreadyAdded'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketConfig {
  readonly __typename: 'BucketConfig'
  readonly name: Scalars['String']
  readonly title: Scalars['String']
  readonly iconUrl: Maybe<Scalars['String']>
  readonly description: Maybe<Scalars['String']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly relevanceScore: Scalars['Int']
  readonly lastIndexed: Maybe<Scalars['Datetime']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
}

export interface BucketDoesNotExist {
  readonly __typename: 'BucketDoesNotExist'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketNotFound {
  readonly __typename: 'BucketNotFound'
  readonly _: Maybe<Scalars['Boolean']>
}

export type BucketRemoveResult = BucketRemoveSuccess | BucketNotFound | IndexingInProgress

export interface BucketRemoveSuccess {
  readonly __typename: 'BucketRemoveSuccess'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketUpdateInput {
  readonly title: Scalars['String']
  readonly iconUrl: Maybe<Scalars['String']>
  readonly description: Maybe<Scalars['String']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly relevanceScore: Maybe<Scalars['Int']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly setVersioning: Maybe<Scalars['Boolean']>
}

export type BucketUpdateResult =
  | BucketUpdateSuccess
  | BucketNotFound
  | NotificationConfigurationError
  | NotificationTopicNotFound
  | SnsInvalid

export interface BucketUpdateSuccess {
  readonly __typename: 'BucketUpdateSuccess'
  readonly bucketConfig: BucketConfig
}

export interface IndexingInProgress {
  readonly __typename: 'IndexingInProgress'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface InsufficientPermissions {
  readonly __typename: 'InsufficientPermissions'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface Mutation {
  readonly __typename: 'Mutation'
  readonly bucketAdd: BucketAddResult
  readonly bucketUpdate: BucketUpdateResult
  readonly bucketRemove: BucketRemoveResult
}

export interface MutationbucketAddArgs {
  input: BucketAddInput
}

export interface MutationbucketUpdateArgs {
  name: Scalars['String']
  input: BucketUpdateInput
}

export interface MutationbucketRemoveArgs {
  name: Scalars['String']
}

export interface NotificationConfigurationError {
  readonly __typename: 'NotificationConfigurationError'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface NotificationTopicNotFound {
  readonly __typename: 'NotificationTopicNotFound'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface Query {
  readonly __typename: 'Query'
  readonly bucketConfigs: ReadonlyArray<BucketConfig>
  readonly bucketConfig: Maybe<BucketConfig>
}

export interface QuerybucketConfigArgs {
  name: Scalars['String']
}

export interface SnsInvalid {
  readonly __typename: 'SnsInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}
