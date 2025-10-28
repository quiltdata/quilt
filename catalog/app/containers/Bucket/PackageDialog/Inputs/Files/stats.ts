import * as R from 'ramda'

import { isS3File, FilesState } from './State'
import { MAX_UPLOAD_SIZE, MAX_S3_SIZE, MAX_FILE_COUNT } from './constants'

export interface StatsWarning {
  upload: boolean
  s3: boolean
  count: boolean
}

export interface Stats {
  upload: { count: number; size: number }
  s3: { count: number; size: number }
  hashing: boolean
  warn: StatsWarning | null
}

export const calcStats = (
  { added, existing }: FilesState,
  delayHashing: boolean = false,
): Stats => {
  const upload = Object.entries(added).reduce(
    (acc, [path, f]) => {
      if (isS3File(f)) return acc // dont count s3 files
      const e = existing[path]
      if (e && (!f.hash.ready || R.equals(f.hash.value, e.hash))) return acc
      return R.evolve({ count: R.inc, size: R.add(f.size) }, acc)
    },
    { count: 0, size: 0 },
  )
  const s3 = Object.entries(added).reduce(
    (acc, [, f]) =>
      isS3File(f) ? R.evolve({ count: R.inc, size: R.add(f.size) }, acc) : acc,
    { count: 0, size: 0 },
  )
  const hashing = Object.values(added).reduce(
    (acc, f) => acc || (!isS3File(f) && !f.hash.ready),
    false,
  )
  const warn = {
    upload: upload.size > MAX_UPLOAD_SIZE,
    s3: s3.size > MAX_S3_SIZE,
    count: upload.count + s3.count > MAX_FILE_COUNT,
  }
  const hasWarning = warn.upload || warn.s3 || warn.count
  return {
    upload,
    s3,
    hashing: !delayHashing && hashing,
    warn: hasWarning ? warn : null,
  }
}
