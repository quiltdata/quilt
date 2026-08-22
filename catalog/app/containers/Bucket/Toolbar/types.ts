import * as Model from 'model'
import * as s3paths from 'utils/s3paths'

export interface DirHandle {
  _tag: 'dir'
  bucket: string
  /** Path relative to a bucket root, without leading slash */
  path: string
}

export const DirHandleCreate = (bucket: string, path: string): DirHandle => ({
  _tag: 'dir',
  bucket,
  path: s3paths.withoutPrefix('/', s3paths.ensureSlash(path)),
})

export interface FileHandle extends Model.S3.S3ObjectLocation {
  _tag: 'file'
}

export const FileHandleCreate = (
  bucket: string,
  key: string,
  version?: string,
): FileHandle => ({
  _tag: 'file',
  bucket,
  key,
  version,
})

export type Handle = DirHandle | FileHandle
