import type { S3 } from 'aws-sdk'

import * as quiltConfigs from 'constants/quiltConfigs'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'
import type { JsonRecord } from 'utils/types'
import * as workflows from 'utils/workflows'

import { FileNotFound, VersionNotFound } from '../errors'

import { decodeS3Key } from './utils'
import { ensureObjectIsPresent } from './requestsUntyped'

interface ObjectTagsArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

export const objectTags = ({
  s3,
  handle: { bucket, key, version },
}: ObjectTagsArgs): Promise<Record<string, string>> =>
  s3
    .getObjectTagging({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
    .then(({ TagSet }) =>
      TagSet.reduce((memo, { Key, Value }) => ({ ...memo, [Key]: Value }), {}),
    )

interface ObjectMetaArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

export const objectMeta = async ({
  s3,
  handle: { bucket, key, version },
}: ObjectMetaArgs): Promise<JsonRecord | undefined> => {
  const r = await s3
    .headObject({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
  if (r.Metadata?.helium) {
    return JSON.parse(r.Metadata?.helium)
  }
}

type ExistingObject = Model.S3.S3ObjectLocation & { size?: number; lastModified?: Date }

interface EnsureObjectIsPresentInCollectionArgs {
  s3: S3
  handles: Model.S3.S3ObjectLocation[]
}

const ensureObjectIsPresentInCollection = async ({
  s3,
  handles,
}: EnsureObjectIsPresentInCollectionArgs): Promise<ExistingObject | null> => {
  if (!handles.length) return null

  const [handle, ...handlesTail] = handles
  const existingObject = await ensureObjectIsPresent({
    s3,
    ...handle,
  })

  return (
    existingObject ||
    (await ensureObjectIsPresentInCollection({ s3, handles: handlesTail }))
  )
}

interface GetObjectArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

const getObject = ({ s3, handle }: GetObjectArgs) =>
  s3
    .getObject({
      Bucket: handle.bucket,
      Key: handle.key,
      VersionId: handle.version,
    })
    .promise()
    .then(({ Body }) => ({
      handle,
      body: Body,
    }))

interface DeleteObjectArgs {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

export const deleteObject = async ({
  s3,
  handle: { bucket, key, version },
}: DeleteObjectArgs): Promise<void> => {
  await s3
    .deleteObject({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
}

interface ObjectVersionsArgs {
  s3: S3
  bucket: string
  path: string
}

type ListItem = S3.ObjectVersion | S3.DeleteMarkerEntry

const isDeleteMarker = (v: ListItem): v is S3.DeleteMarkerEntry =>
  (v as S3.ObjectVersion).Size == null

const isObjectVersion = (v: ListItem): v is S3.ObjectVersion =>
  (v as S3.ObjectVersion).Size != null

export const objectVersions = async ({ s3, bucket, path }: ObjectVersionsArgs) => {
  const { Versions, DeleteMarkers } = await s3
    .listObjectVersions({ Bucket: bucket, Prefix: path, EncodingType: 'url' })
    .promise()
  return ([...(Versions || []), ...(DeleteMarkers || [])] as ListItem[])
    .filter(({ Key }) => decodeS3Key(Key || '') === path)
    .map((v) => ({
      isLatest: v.IsLatest || false,
      lastModified: v.LastModified,
      // TODO: make two separate maps, object version can be without `Size`
      size: isObjectVersion(v) ? v.Size : undefined,
      id: v.VersionId,
      deleteMarker: isDeleteMarker(v),
      archived: isObjectVersion(v)
        ? v.StorageClass === 'GLACIER' || v.StorageClass === 'DEEP_ARCHIVE'
        : false,
    }))
    .toSorted(({ lastModified: left }, { lastModified: right }) => {
      if (left && right) return right.getTime() - left.getTime()
      if (left) return -1
      if (right) return 1
      return 0
    })
}

interface FetchFileInCollectionArgs {
  s3: S3
  handles: Model.S3.S3ObjectLocation[]
}

export async function fetchFileInCollection({ s3, handles }: FetchFileInCollectionArgs) {
  const existingObject = await ensureObjectIsPresentInCollection({ s3, handles })
  if (!existingObject) {
    throw new FileNotFound(`No object in ${JSON.stringify(handles)} exist`)
  }
  return getObject({ s3, handle: existingObject })
}

interface FetchFile {
  s3: S3
  handle: Model.S3.S3ObjectLocation
}

export async function fetchFile({ s3, handle }: FetchFile) {
  const existingObject: ExistingObject | null = await ensureObjectIsPresent({
    s3,
    ...handle,
  })
  if (!existingObject) {
    throw new FileNotFound(`Object ${JSON.stringify(handle)} doesn't exist`)
  }
  return getObject({ s3, handle: existingObject })
}

interface MetadataSchemaArgs {
  s3: S3
  // TODO: S3ObjectLocation
  schemaUrl?: string
}

export const metadataSchema = async ({ s3, schemaUrl }: MetadataSchemaArgs) => {
  if (!schemaUrl) return null

  const handle = s3paths.parseS3Url(schemaUrl)

  const response = await fetchFile({ s3, handle })
  return JSON.parse(response.body?.toString('utf-8') || '{}')
}

export const WORKFLOWS_CONFIG_PATH = quiltConfigs.workflows
// TODO: enable this when backend is ready
// const WORKFLOWS_CONFIG_PATH = [
//   '.quilt/workflows/config.yaml',
//   '.quilt/workflows/config.yml',
// ]

interface WorkflowsConfigArgs {
  s3: S3
  bucket: string
}

export const workflowsConfig = async ({ s3, bucket }: WorkflowsConfigArgs) => {
  try {
    const response = await fetchFile({
      s3,
      handle: { bucket, key: WORKFLOWS_CONFIG_PATH },
    })
    return workflows.parse(response.body?.toString('utf-8') || '')
  } catch (e) {
    if (e instanceof FileNotFound || e instanceof VersionNotFound)
      return workflows.emptyConfig

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}
