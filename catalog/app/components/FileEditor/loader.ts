import * as R from 'ramda'
import * as React from 'react'

import { detect as isMarkdown } from 'components/Preview/loaders/Markdown'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import * as AWS from 'utils/AWS'
import type { S3HandleBase } from 'utils/s3paths'
import type * as Model from 'model'

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

const isJson = PreviewUtils.extIn(['.json'])
const typeJson: EditorInputType = {
  brace: 'json',
}

const isText = PreviewUtils.extIn(['.txt', ''])
const typeText: EditorInputType = {
  brace: 'text',
}

const typeNone: EditorInputType = {
  brace: null,
}

export const detect: (path: string) => EditorInputType = R.pipe(
  PreviewUtils.stripCompression,
  R.cond([
    [isJson, R.always(typeJson)],
    [isMarkdown, R.always(typeMarkdown)],
    [isText, R.always(typeText)],
    [isYaml, R.always(typeYaml)],
    [R.T, R.always(typeNone)],
  ]),
)

export function useWriteData({
  bucket,
  key,
}: S3HandleBase): (value: string) => Promise<Model.S3File> {
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (value) => {
      const { VersionId: version } = await s3
        .putObject({ Bucket: bucket, Key: key, Body: value })
        .promise()
      const { ContentLength: size } = await s3
        .headObject({ Bucket: bucket, Key: key, VersionId: version })
        .promise()
      return { bucket, key, size, version }
    },
    [bucket, key, s3],
  )
}
