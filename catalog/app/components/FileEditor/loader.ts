import * as R from 'ramda'
import * as React from 'react'

import { detect as isMarkdown } from 'components/Preview/loaders/Markdown'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import * as AWS from 'utils/AWS'
import type { S3HandleBase } from 'utils/s3paths'

import { Mode, EditorInputType } from './types'

const cache: { [index in Mode]?: Promise<void> | 'fullfilled' } = {}
export const loadMode = (mode: Mode) => {
  if (cache[mode] === 'fullfilled') return cache[mode]
  if (cache[mode]) throw cache[mode]

  cache[mode] = import(`brace/mode/${mode}`).then(() => {
    cache[mode] = 'fullfilled'
  })
  throw cache[mode]
}

const isYaml = PreviewUtils.extIn(['.yaml', '.yml'])
const typeYaml: EditorInputType = {
  brace: 'yaml',
}

const typeMarkdown: EditorInputType = {
  brace: 'markdown',
}

const typeNone: EditorInputType = {
  brace: null,
}

export const detect: (path: string) => EditorInputType = R.pipe(
  PreviewUtils.stripCompression,
  R.cond([
    [isMarkdown, R.always(typeMarkdown)],
    [isYaml, R.always(typeYaml)],
    [R.T, R.always(typeNone)],
  ]),
)

export function useWriteData({
  bucket,
  key,
}: S3HandleBase): (value: string) => Promise<S3HandleBase> {
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (value) => {
      const { VersionId } = await s3
        .putObject({ Bucket: bucket, Key: key, Body: value })
        .promise()
      return { bucket, key, version: VersionId }
    },
    [bucket, key, s3],
  )
}
