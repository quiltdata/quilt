import type { S3 } from 'aws-sdk'
import * as R from 'ramda'
import * as React from 'react'

import * as quiltConfigs from 'constants/quiltConfigs'
import { detect as isMarkdown } from 'components/Preview/loaders/Markdown'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'

import { Mode, EditorInputType } from './types'

// A rejected `import()` may not stay cached as a promise: React retries on rejection
// too, so rethrowing the same rejected promise re-suspends on every render and the
// fallback never clears. Cache the failure as an error, which a boundary can catch.
const cache: { [index in Mode]?: Promise<void> | 'fulfilled' | Error } = {}
export const loadMode = (mode: Mode) => {
  const cached = cache[mode]
  if (cached === 'fulfilled') return cached
  // A cached failure is handed out once and then forgotten, so remounting after a
  // transient chunk-fetch failure retries instead of rethrowing for the whole session.
  if (cached instanceof Error) {
    delete cache[mode]
    throw cached
  }
  if (cached) throw cached

  cache[mode] = import(`brace/mode/${mode}`).then(
    () => {
      cache[mode] = 'fulfilled'
    },
    (e) => {
      cache[mode] =
        e instanceof Error ? e : new Error(`Failed to load editor mode "${mode}"`)
    },
  )
  throw cache[mode]
}

const isQuiltConfig = (path: string) =>
  quiltConfigs.all.some((quiltConfig) => quiltConfig.includes(path))
const typeQuiltConfig: EditorInputType = {
  title: 'Edit with config helper',
  brace: '__quiltConfig',
}

const isQuiltSummarize = (path: string) => path.endsWith(quiltConfigs.quiltSummarize)
const typeQuiltSummarize: EditorInputType = {
  title: 'Edit with config helper',
  brace: '__quiltSummarize',
}

const isBucketPreferences = (path: string) =>
  quiltConfigs.bucketPreferences.some((quiltConfig) => quiltConfig.includes(path))
const typeBucketPreferences: EditorInputType = {
  title: 'Edit with config helper',
  brace: '__bucketPreferences',
}

const isCsv = PreviewUtils.extIn(['.csv', '.tsv', '.tab'])
const typeCsv: EditorInputType = {
  brace: 'less',
}

const isJson = PreviewUtils.extIn(['.json'])
const typeJson: EditorInputType = {
  brace: 'json',
}

const typeMarkdown: EditorInputType = {
  brace: 'markdown',
}

const isText = PreviewUtils.extIn(['.txt', ''])
const typeText: EditorInputType = {
  brace: 'plain_text',
}

const isYaml = PreviewUtils.extIn(['.yaml', '.yml'])
const typeYaml: EditorInputType = {
  brace: 'yaml',
}

const typeNone: EditorInputType = {
  brace: null,
}

export const detect: (path: string) => EditorInputType[] = R.pipe(
  PreviewUtils.stripCompression,
  R.cond([
    [isQuiltSummarize, R.always([typeQuiltSummarize, typeJson])],
    [isBucketPreferences, R.always([typeBucketPreferences, typeYaml])],
    [isQuiltConfig, R.always([typeQuiltConfig, typeYaml])],
    [isCsv, R.always([typeCsv])],
    [isJson, R.always([typeJson])],
    [isMarkdown, R.always([typeMarkdown])],
    [isText, R.always([typeText])],
    [isYaml, R.always([typeYaml])],
    [R.T, R.always([typeNone])],
  ]),
)

export const isSupportedFileType: (path: string) => boolean = R.pipe(
  detect,
  R.path([0, 'brace']),
  Boolean,
)

type AWSError = Error & { code: string }

async function validToWriteFile(s3: S3, bucket: string, key: string, version?: string) {
  try {
    const { VersionId } = await s3.headObject({ Bucket: bucket, Key: key }).promise()
    return VersionId === version
  } catch (error) {
    if (error instanceof Error && (error as AWSError).code === 'NotFound') return true
    throw error
  }
}

export function useWriteData({
  bucket,
  key,
  version,
}: Model.S3.S3ObjectLocation): (value: string) => Promise<Model.S3File> {
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (value) => {
      const valid = await validToWriteFile(s3, bucket, key, version)
      if (!valid) throw new Error('Revision is outdated')
      const { VersionId } = await s3
        .putObject({ Bucket: bucket, Key: key, Body: value })
        .promise()
      const { ContentLength: size } = await s3
        .headObject({ Bucket: bucket, Key: key, VersionId })
        .promise()
      return { bucket, key, size, version: VersionId }
    },
    [bucket, key, s3, version],
  )
}
