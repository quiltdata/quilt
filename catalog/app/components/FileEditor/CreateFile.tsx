import { join, extname } from 'path'

import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as Dialog from 'components/Dialog'
import * as NamedRoutes from 'utils/NamedRoutes'
import type { PackageHandle } from 'utils/packageHandle'

import { isSupportedFileType } from './loader'

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
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const toFile = React.useCallback(
    (name: string) => urls.bucketFile(bucket, join(path, name), { edit: true }),
    [bucket, path, urls],
  )

  const createFile = React.useCallback(
    (_e, name: string) => {
      if (!name) return
      history.push(toFile(name))
    },
    [history, toFile],
  )

  return Dialog.usePrompt({
    onSubmit: createFile,
    initialValue: 'README.md',
    title: 'Enter file name',
    validate: validateFileName,
  })
}

export function useCreateFileInPackage({ bucket, name }: PackageHandle, prefix?: string) {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const toFile = React.useCallback(
    (fileName: string) => {
      const next = urls.bucketPackageDetail(bucket, name, { action: 'revisePackage' })
      const key = join(name, fileName)
      return urls.bucketFile(bucket, key, {
        add: fileName,
        edit: true,
        next,
      })
    },
    [bucket, name, urls],
  )

  const createFile = React.useCallback(
    (_e, fileName: string) => {
      if (!fileName) return
      history.push(toFile(fileName))
    },
    [history, toFile],
  )

  const defaultFileName = 'README.md'
  return Dialog.usePrompt({
    onSubmit: createFile,
    initialValue: prefix ? `${prefix}${defaultFileName}` : defaultFileName,
    title: 'Enter file name',
    validate: validateFileName,
  })
}
