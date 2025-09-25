import cfg from 'constants/config'

export const MAX_UPLOAD_SIZE = 20 * 1000 * 1000 * 1000 // 20GB
// XXX: keep in sync w/ the backend
// NOTE: these limits are lower than the actual "hard" limits on the backend
export const MAX_S3_SIZE = cfg.chunkedChecksums
  ? 5 * 10 ** 12 // 5 TB
  : 50 * 10 ** 9 // 50 GB
export const MAX_FILE_COUNT = 1000
