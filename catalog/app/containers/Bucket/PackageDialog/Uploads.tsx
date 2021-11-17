import type { S3 } from 'aws-sdk'
import * as FP from 'fp-ts'
import pLimit from 'p-limit'
import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import dissocBy from 'utils/dissocBy'
import * as s3paths from 'utils/s3paths'
import useMemoEq from 'utils/useMemoEq'

import type { LocalFile, ExistingFile } from './FilesInput'

interface UploadResult extends S3.ManagedUpload.SendData {
  VersionId: string
}

export interface UploadTotalProgress {
  total: number
  loaded: number
  percent: number
}

export interface UploadsState {
  [path: string]: {
    file: File
    promise: Promise<S3.ManagedUpload.SendData>
    progress?: { total: number; loaded: number }
  }
}

export const computeTotalProgress = (uploads: UploadsState): UploadTotalProgress =>
  FP.function.pipe(
    uploads,
    R.values,
    R.reduce(
      (acc, { progress: p }) => ({
        total: acc.total + ((p && p.total) || 0),
        loaded: acc.loaded + ((p && p.loaded) || 0),
      }),
      { total: 0, loaded: 0 },
    ),
    (p) => ({
      ...p,
      percent: p.total ? Math.floor((p.loaded / p.total) * 100) : 100,
    }),
  )

export function useUploads() {
  const s3 = AWS.S3.use()

  const [uploads, setUploads] = React.useState<UploadsState>({})
  const progress = React.useMemo(() => computeTotalProgress(uploads), [uploads])

  const remove = React.useCallback(
    (path: string) => setUploads(R.dissoc(path)),
    [setUploads],
  )
  const removeByPrefix = React.useCallback(
    (prefix: string) => setUploads(dissocBy(R.startsWith(prefix))),
    [setUploads],
  )
  const reset = React.useCallback(() => setUploads({}), [setUploads])

  const doUpload = React.useCallback(
    async ({
      files,
      bucket,
      prefix,
      getMeta,
    }: {
      files: { path: string; file: LocalFile }[]
      bucket: string
      prefix: string
      getMeta?: (path: string) => object | undefined
    }) => {
      const limit = pLimit(2)
      let rejected = false
      const pendingUploads: Record<string, S3.ManagedUpload> = {}

      const uploadFile = async (path: string, file: LocalFile) => {
        if (rejected) {
          remove(path)
          return undefined as never
        }

        const upload: S3.ManagedUpload = s3.upload({
          Bucket: bucket,
          Key: `${prefix}/${path}`,
          Body: file,
        })

        upload.on('httpUploadProgress', ({ loaded }) => {
          if (rejected) return
          setUploads(R.assocPath([path, 'progress', 'loaded'], loaded))
        })

        pendingUploads[path] = upload

        try {
          const uploadP = upload.promise()
          await file.hash.promise
          return await uploadP
        } catch (e) {
          if ((e as any).code !== 'RequestAbortedError') {
            // eslint-disable-next-line no-console
            console.log(`Error uploading file "${file.name}"`)
            rejected = true
            Object.values(pendingUploads).forEach((u) => u.abort())
          }
          remove(path)
          throw e
        } finally {
          delete pendingUploads[path]
        }
      }

      const uploadStates = files.map(({ path, file }) => {
        // reuse state if file hasnt changed
        const entry = uploads[path]
        if (entry && entry.file === file) return { ...entry, path }

        const promise = limit(uploadFile, path, file)
        return { path, file, promise, progress: { total: file.size, loaded: 0 } }
      })

      FP.function.pipe(
        uploadStates,
        R.map(({ path, ...rest }) => ({ [path]: rest })),
        R.mergeAll,
        setUploads,
      )

      const uploaded = await Promise.all(uploadStates.map((x) => x.promise))

      return FP.function.pipe(
        FP.array.zipWith(
          files,
          uploaded,
          (f, r) =>
            [
              f.path,
              {
                physicalKey: s3paths.handleToS3Url({
                  bucket,
                  key: r.Key,
                  version: (r as UploadResult).VersionId,
                }),
                size: f.file.size,
                hash: f.file.hash.value,
                meta: getMeta?.(f.path),
              },
            ] as R.KeyValuePair<string, ExistingFile>,
        ),
        R.fromPairs,
      )
    },
    [remove, s3, uploads],
  )

  return useMemoEq(
    { uploads, upload: doUpload, progress, remove, removeByPrefix, reset },
    R.identity,
  )
}
