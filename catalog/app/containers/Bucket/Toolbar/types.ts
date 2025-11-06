import * as Model from 'model'
import * as s3paths from 'utils/s3paths'

export interface DirHandle {
  _tag: 'dir'
  bucket: string
  path: string
}

export const DirHandleCreate = (bucket: string, path: string): DirHandle => ({
  _tag: 'dir',
  bucket,
  path: path ? s3paths.ensureSlash(path) : path,
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
