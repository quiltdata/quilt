import { join, extname } from 'path'

import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as Dialog from 'components/Dialog'
import type { PackageHandle } from 'utils/packageHandle'

import { isSupportedFileType } from './loader'
import { useAddFileInBucket, useAddFileInPackage } from './routes'

function validateFileName(value: string) {
  if (!value) {
    return new Error('File name is required')
  }
  if (!isSupportedFileType(value) || extname(value) === '.' || !extname(value)) {
    // TODO: get list of supported extensions from FileEditor
    return new Error('Supported file formats are JSON, Markdown, YAML and text')
  }
}

export function useCreateFileInBucket(bucket: string, path: string) {
  const history = RRDom.useHistory()
  const toFile = useAddFileInBucket(bucket)

  const onSubmit = React.useCallback(
    (name: string) => {
      invariant(
        name,
        '`name` should be invalidated, and `onSubmit` should not be triggered',
      )
      history.push(toFile(join(path, name)))
    },
    [history, toFile, path],
  )

  return Dialog.usePrompt({
    onSubmit,
    initialValue: 'README.md',
    title: 'Enter file name',
    validate: validateFileName,
  })
}

export function useCreateFileInPackage(packageHandle: PackageHandle, prefix?: string) {
  const history = RRDom.useHistory()
  const toFile = useAddFileInPackage(packageHandle)

  const onSubmit = React.useCallback(
    (fileName: string) => {
      invariant(
        fileName,
        '`fileName` should be invalidated, and `onSubmit` should not be triggered',
      )
      history.push(toFile(fileName))
    },
    [history, toFile],
  )

  const defaultFileName = 'README.md'
  return Dialog.usePrompt({
    onSubmit,
    initialValue: prefix ? `${prefix}${defaultFileName}` : defaultFileName,
    title: 'Enter file name',
    validate: validateFileName,
  })
}
