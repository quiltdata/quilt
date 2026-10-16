import type { S3 } from 'aws-sdk'
import * as R from 'ramda'

import * as quiltConfigs from 'constants/quiltConfigs'
import { getArchiveState } from 'utils/glacier'
import Log from 'utils/Logging'
import type * as Model from 'model'
import * as S3Tags from 'utils/s3Tags'
import * as s3paths from 'utils/s3paths'
import type { JsonRecord } from 'utils/types'
import * as workflows from 'utils/workflows'
import * as YAML from 'utils/yaml'

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
  handle: { bucket, key },
}: DeleteObjectArgs): Promise<void> => {
  await s3
    .deleteObject({
      Bucket: bucket,
      Key: key,
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
    .listObjectVersions({
      Bucket: bucket,
      Prefix: path,
      EncodingType: 'url',
      OptionalObjectAttributes: ['RestoreStatus'], // so restores show as available
    })
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
        ? !!getArchiveState(v.StorageClass, v.RestoreStatus).archived
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

interface S3TagsConfigArgs {
  s3: S3
  bucket: string
}

/** `null` when the bucket doesn't project metadata onto S3 tags */
export const s3TagsConfig = async ({
  s3,
  bucket,
}: S3TagsConfigArgs): Promise<S3Tags.S3TagsConfig | null> => {
  try {
    const response = await fetchFile({ s3, handle: { bucket, key: quiltConfigs.s3Tags } })
    const parsed = YAML.parseStrict(response.body?.toString('utf-8'))
    if (parsed instanceof Error) throw parsed
    return S3Tags.parseConfig(parsed)
  } catch (e) {
    if (e instanceof FileNotFound || e instanceof VersionNotFound) return null
    throw e
  }
}

interface ApplyS3TagsArgs {
  s3: S3
  config: S3Tags.S3TagsConfig
  meta: JsonRecord | undefined
  bucket: string
  physicalKeys: string[]
}

export interface ApplyS3TagsResult {
  tagged: number
  /** Already carried the projected tags, so nothing was written */
  unchanged: number
  skipped: { physicalKey: string; reason: string }[]
}

const TAGGING_CONCURRENCY = 8

// ponytail: tags are written from the browser after the push; a stack-side projector
// on the package-revision event replaces this for all clients.
export async function applyS3Tags({
  s3,
  config,
  meta,
  bucket,
  physicalKeys,
}: ApplyS3TagsArgs): Promise<ApplyS3TagsResult> {
  const projected = S3Tags.project(config, meta)
  const result: ApplyS3TagsResult = { tagged: 0, unchanged: 0, skipped: [] }
  const skip = (physicalKey: string, reason: string) => {
    result.skipped.push({ physicalKey, reason })
  }

  const tagOne = async (physicalKey: string) => {
    try {
      const handle = s3paths.parseS3Url(physicalKey)
      // Objects outside the destination bucket may be shared with other packages
      // or owned by another account, so they keep their tags.
      if (handle.bucket !== bucket) return skip(physicalKey, 'Outside the package bucket')
      // Without a version the current object may not be the one in the manifest.
      if (!handle.version) return skip(physicalKey, 'No object version')
      // Registry roles hold s3:PutObjectTagging but not s3:PutObjectVersionTagging,
      // so only the current version can be tagged, addressed without VersionId.
      const head = await s3
        .headObject({ Bucket: handle.bucket, Key: handle.key })
        .promise()
      if (head.VersionId !== handle.version) {
        return skip(physicalKey, 'Not the current version of the object')
      }
      const existing = await objectTags({ s3, handle })
      const tags = S3Tags.merge(config, projected, existing)
      if (Object.keys(tags).length > S3Tags.MAX_TAGS) {
        return skip(physicalKey, 'More than 10 tags')
      }
      if (R.equals(tags, existing)) {
        result.unchanged += 1
        return
      }
      // ponytail: a write landing after headObject gets these tags; the projector tags by version.
      await s3
        .putObjectTagging({
          Bucket: handle.bucket,
          Key: handle.key,
          Tagging: {
            TagSet: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
          },
        })
        .promise()
      result.tagged += 1
    } catch (e) {
      Log.error(e)
      skip(physicalKey, e instanceof Error ? e.message : 'Tagging failed')
    }
  }

  const queue = [...physicalKeys]
  const worker = async () => {
    while (queue.length) await tagOne(queue.shift()!)
  }
  await Promise.all(Array.from({ length: TAGGING_CONCURRENCY }, worker))
  return result
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
  strict?: boolean
}

export const workflowsConfig = async ({ s3, bucket, strict }: WorkflowsConfigArgs) => {
  try {
    const response = await fetchFile({
      s3,
      handle: { bucket, key: WORKFLOWS_CONFIG_PATH },
    })
    return workflows.parse(response.body?.toString('utf-8') || '', bucket, { strict })
  } catch (e) {
    if (e instanceof FileNotFound || e instanceof VersionNotFound) {
      return strict ? workflows.nullConfig : workflows.emptyConfig(bucket)
    }

    Log.info('Unable to fetch')
    Log.error(e)
    throw e
  }
}
