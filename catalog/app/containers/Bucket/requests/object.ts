import type { S3 } from 'aws-sdk'
import * as R from 'ramda'

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

export const objectMeta = ({
  s3,
  handle: { bucket, key, version },
}: ObjectMetaArgs): Promise<JsonRecord> =>
  s3
    .headObject({
      Bucket: bucket,
      Key: key,
      VersionId: version,
    })
    .promise()
    // @ts-expect-error
    .then(R.pipe(R.path(['Metadata', 'helium']), R.when(Boolean, JSON.parse)))

interface EnsureObjectIsPresentInCollectionArgs {
  s3: S3
  bucket: string
  keys: string[]
  version?: string
}

const ensureObjectIsPresentInCollection = async ({
  s3,
  bucket,
  keys,
  version,
}: EnsureObjectIsPresentInCollectionArgs): Promise<Model.S3.S3ObjectLocation | null> => {
  if (!keys.length) return null

  const [key, ...keysTail] = keys
  const existingObject = await ensureObjectIsPresent({
    s3,
    bucket,
    key,
    version,
  })

  return (
    existingObject ||
    (await ensureObjectIsPresentInCollection({ s3, bucket, keys: keysTail }))
  )
}

interface FetchFileVersionedArgs {
  s3: S3
  bucket: string
  path: string
  version?: string
}

const fetchFileVersioned = async ({
  s3,
  bucket,
  path,
  version,
}: FetchFileVersionedArgs) => {
  const keys = Array.isArray(path) ? path : [path]
  const versionExists = await ensureObjectIsPresentInCollection({
    s3,
    bucket,
    keys,
    version,
  })
  if (!versionExists) {
    throw new VersionNotFound(
      `${path} for ${bucket} and version ${version} does not exist`,
    )
  }

  // TODO: also return `versionExists.key`
  return s3
    .getObject({
      // TODO
      // ResponseCacheControl: 'max-age=0',
      Bucket: bucket,
      Key: versionExists.key,
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

export const objectVersions = ({ s3, bucket, path }: ObjectVersionsArgs) =>
  s3
    .listObjectVersions({ Bucket: bucket, Prefix: path, EncodingType: 'url' })
    .promise()
    .then(
      ({ Versions, DeleteMarkers }) =>
        [...(Versions || []), ...(DeleteMarkers || [])] as ListItem[],
    )
    .then((x) => {
      const z = x.map((y) => ({ ...y, Key: decodeS3Key(y.Key || '') }))
      return z
    })
    .then(R.map<ListItem, ListItem>(R.evolve({ Key: decodeS3Key })))
    .then(R.filter<ListItem>((v) => v.Key === path))
    .then(
      R.map((v) => ({
        isLatest: v.IsLatest || false,
        lastModified: v.LastModified,
        size: isObjectVersion(v) ? v.Size : undefined,
        id: v.VersionId,
        deleteMarker: isDeleteMarker(v),
        archived: isObjectVersion(v)
          ? v.StorageClass === 'GLACIER' || v.StorageClass === 'DEEP_ARCHIVE'
          : false,
      })),
    )
    .then(R.sort(R.descend(R.prop('lastModified'))))

interface FetchFileLatestArgs {
  s3: S3
  bucket: string
  path: string
}

const fetchFileLatest = async ({ s3, bucket, path }: FetchFileLatestArgs) => {
  const keys = Array.isArray(path) ? path : [path]
  const fileExists = await ensureObjectIsPresentInCollection({
    s3,
    bucket,
    keys,
  })
  if (!fileExists) {
    throw new FileNotFound(`${path} for ${bucket} does not exist`)
  }

  const versions = await objectVersions({
    s3,
    bucket,
    path: fileExists.key,
  })
  const latest = R.find(R.prop('isLatest'), versions)
  const version = latest && latest.id !== 'null' ? latest.id : undefined

  return fetchFileVersioned({ s3, bucket, path: fileExists.key, version })
}

export const fetchFile = R.ifElse(R.prop('version'), fetchFileVersioned, fetchFileLatest)

interface MetadataSchemaArgs {
  s3: S3
  schemaUrl?: string
}

export const metadataSchema = async ({ s3, schemaUrl }: MetadataSchemaArgs) => {
  if (!schemaUrl) return null

  const { bucket, key, version } = s3paths.parseS3Url(schemaUrl)

  const response = await fetchFile({ s3, bucket, path: key, version })
  return JSON.parse(response.Body.toString('utf-8'))
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
    const response = await fetchFile({ s3, bucket, path: WORKFLOWS_CONFIG_PATH })
    return workflows.parse(response.Body.toString('utf-8'))
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
