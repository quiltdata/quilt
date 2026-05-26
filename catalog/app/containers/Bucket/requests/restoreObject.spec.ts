import type { S3 } from 'aws-sdk'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

import log from 'utils/Logging'

import {
  restoreObject,
  RestoreAlreadyInProgressError,
  GlacierExpeditedUnavailableError,
  RestoreAccessDeniedError,
} from './object'

vi.mock('constants/config', () => ({ default: {} }))

class AWSError extends Error {
  code: string

  constructor(code: string, message?: string) {
    super(message)
    this.code = code
  }
}

function mockS3RestoreObject({
  statusCode,
  error,
}: {
  statusCode?: number
  error?: AWSError
}) {
  const restoreObjectFn = vi.fn(() => ({
    response: { httpResponse: { statusCode } },
    promise: () => (error ? Promise.reject(error) : Promise.resolve({})),
  }))
  return { s3: { restoreObject: restoreObjectFn } as unknown as S3, restoreObjectFn }
}

const handle = { bucket: 'B', key: 'K', version: 'V' }

describe('app/containers/Bucket/requests/object/restoreObject', () => {
  const origError = log.error
  beforeAll(() => {
    log.error = vi.fn() as $TSFixMe
  })
  afterAll(() => {
    log.error = origError
  })

  it('passes Bucket/Key/VersionId/RestoreRequest to S3', async () => {
    const { s3, restoreObjectFn } = mockS3RestoreObject({ statusCode: 202 })
    await restoreObject({ s3, handle, tier: 'Standard', days: 7 })
    expect(restoreObjectFn).toHaveBeenCalledWith({
      Bucket: 'B',
      Key: 'K',
      VersionId: 'V',
      RestoreRequest: { Days: 7, GlacierJobParameters: { Tier: 'Standard' } },
    })
  })

  it('returns alreadyRestored=false on 202 Accepted', async () => {
    const { s3 } = mockS3RestoreObject({ statusCode: 202 })
    const result = await restoreObject({ s3, handle, tier: 'Standard', days: 7 })
    expect(result).toEqual({ alreadyRestored: false })
  })

  it('returns alreadyRestored=true on 200 OK', async () => {
    const { s3 } = mockS3RestoreObject({ statusCode: 200 })
    const result = await restoreObject({ s3, handle, tier: 'Bulk', days: 14 })
    expect(result).toEqual({ alreadyRestored: true })
  })

  it('throws RestoreAlreadyInProgressError on 409', async () => {
    const { s3 } = mockS3RestoreObject({
      error: new AWSError('RestoreAlreadyInProgress'),
    })
    await expect(
      restoreObject({ s3, handle, tier: 'Standard', days: 7 }),
    ).rejects.toBeInstanceOf(RestoreAlreadyInProgressError)
  })

  it('throws GlacierExpeditedUnavailableError on 503', async () => {
    const { s3 } = mockS3RestoreObject({
      error: new AWSError('GlacierExpeditedRetrievalNotAvailable'),
    })
    await expect(
      restoreObject({ s3, handle, tier: 'Expedited', days: 1 }),
    ).rejects.toBeInstanceOf(GlacierExpeditedUnavailableError)
  })

  it('throws RestoreAccessDeniedError on 403', async () => {
    const { s3 } = mockS3RestoreObject({ error: new AWSError('AccessDenied') })
    await expect(
      restoreObject({ s3, handle, tier: 'Standard', days: 7 }),
    ).rejects.toBeInstanceOf(RestoreAccessDeniedError)
  })

  it('re-throws unknown errors', async () => {
    const err = new AWSError('SomethingElse')
    const { s3 } = mockS3RestoreObject({ error: err })
    await expect(restoreObject({ s3, handle, tier: 'Standard', days: 7 })).rejects.toBe(
      err,
    )
  })
})
