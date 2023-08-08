import { join, extname } from 'path'

import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as Dialog from 'components/Dialog'
import type * as Model from 'model'
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

export function useCreateFileInBucket({ bucket, key }: Model.S3.S3ObjectLocation) {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const toFile = React.useCallback(
    (name: string) => urls.bucketFile({ bucket, key: join(key, name) }, { edit: true }),
    [bucket, key, urls],
  )

  const createFile = React.useCallback(
    (name: string) => {
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

export function useCreateFileInPackage(handle: PackageHandle, prefix?: string) {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const toFile = React.useCallback(
    (fileName: string) => {
      const next = urls.bucketPackageDetail(handle, { action: 'revisePackage' })
      const key = join(handle.name, fileName)
      return urls.bucketFile(
        { bucket: handle.bucket, key },
        {
          add: fileName,
          edit: true,
          next,
        },
      )
    },
    [handle, urls],
  )

  const createFile = React.useCallback(
    (fileName: string) => {
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
