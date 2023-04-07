import pLimit from 'p-limit'

import cfg from 'constants/config'
import * as Model from 'model'

// 8 MiB -- boto3 default: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/customizations/s3.html#boto3.s3.transfer.TransferConfig
const MIN_PART_SIZE = 1024 ** 2 * 8

const MAX_PARTS = 10000 // Maximum number of parts per upload supported by S3

function getPartSize(fileSize: number): number | null {
  // use single-part upload (and plain SHA256 hash)
  if (!cfg.multipartChecksums || fileSize < MIN_PART_SIZE) return null

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

const singlepart = (value: ArrayBuffer): Model.Checksum => ({
  value: Buffer.from(value).toString('hex'),
  type: Model.CHECKSUM_TYPE_SP,
})

const multipart = (value: ArrayBuffer, partCount: number): Model.Checksum => ({
  value: `${Buffer.from(value).toString('base64')}-${partCount}`,
  type: Model.CHECKSUM_TYPE_MP,
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
  return window.crypto.subtle.digest('SHA-256', buf)
}

const hashBlobLimit = (blob: Blob) => blobLimit(hashBlob, blob)

async function computeFileChecksum(f: File): Promise<Model.Checksum> {
  if (!window.crypto?.subtle?.digest) throw new Error('Crypto API unavailable')

  const partSize = getPartSize(f.size)

  // single part
  if (partSize === null) return singlepart(await hashBlobLimit(f))

  // multipart
  const parts: Blob[] = []
  let offset = 0
  while (offset < f.size) {
    const end = Math.min(offset + partSize, f.size)
    parts.push(f.slice(offset, end))
    offset = end
  }

  const checksums = await Promise.all(parts.map(hashBlobLimit))
  const value = await window.crypto.subtle.digest('SHA-256', mergeBuffers(checksums))
  return multipart(value, parts.length)
}

const computeFileChecksumLimit = (f: File) => fileLimit(computeFileChecksum, f)

export default computeFileChecksumLimit
