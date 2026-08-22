import pLimit from 'p-limit'

import * as Model from 'model'

// 8 MiB -- boto3 default: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/customizations/s3.html#boto3.s3.transfer.TransferConfig
export const MIN_PART_SIZE = 1024 ** 2 * 8

const MAX_PARTS = 10000 // Maximum number of parts per upload supported by S3

export function getPartSize(fileSize: number): number | null {
  if (fileSize < MIN_PART_SIZE) return null

  // NOTE: in the case where fileSize is exactly equal to MIN_PART_SIZE
  // boto creates a 1-part multipart upload :shrug:
  let partSize = MIN_PART_SIZE
  let numParts = Math.ceil(fileSize / partSize)

  while (numParts > MAX_PARTS) {
    partSize *= 2
    numParts = Math.ceil(fileSize / partSize)
  }

  return partSize
}

const sha256Chunked = (value: ArrayBuffer): Model.Checksum => ({
  value: Buffer.from(value).toString('base64'),
  type: Model.CHECKSUM_TYPE_SHA256_CHUNKED,
})

function mergeBuffers(buffers: ArrayBuffer[]) {
  const buf = new Uint8Array(buffers.reduce((acc, cur) => acc + cur.byteLength, 0))
  let offset = 0
  for (const arr of buffers) {
    buf.set(new Uint8Array(arr), offset)
    offset += arr.byteLength
  }
  return buf
}

// limit concurrency: 2 files / 8 blobs at a time
// XXX: benchmark and fine-tune this
const fileLimit = pLimit(2)
const blobLimit = pLimit(8)

async function hashBlob(blob: Blob) {
  const buf = await blob.arrayBuffer()
  return crypto.subtle.digest('SHA-256', buf)
}

const hashBlobLimit = (blob: Blob) => blobLimit(hashBlob, blob)

async function computeFileChecksum(f: File): Promise<Model.Checksum> {
  if (!crypto?.subtle?.digest) throw new Error('Crypto API unavailable')

  const partSize = getPartSize(f.size) ?? f.size
  const parts: Blob[] = []

  let offset = 0
  while (offset < f.size) {
    const end = Math.min(offset + partSize, f.size)
    parts.push(f.slice(offset, end))
    offset = end
  }

  const checksums = await Promise.all(parts.map(hashBlobLimit))
  const value = await crypto.subtle.digest('SHA-256', mergeBuffers(checksums))
  return sha256Chunked(value)
}

const computeFileChecksumLimit = (f: File) => fileLimit(computeFileChecksum, f)

export default computeFileChecksumLimit
