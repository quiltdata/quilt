import type { S3, AWSError } from 'aws-sdk'
import log from 'loglevel'

import { PreviewError } from '../types'

import { gate } from './useGate'

const handle = {
  bucket: 'B',
  key: 'K',
  version: 'V',
}

function mockS3(responseFunc: any, opts?: any) {
  return {
    headObject: () => ({
      promise: async () => await responseFunc(),
      ...opts,
    }),
  } as S3
}

function mockAWSError(code: string | number): AWSError {
  const error = new Error()
  // @ts-expect-error
  error.code = code
  return error as AWSError
}

function createError(name: string) {
  const error = new Error()
  error.name = name
  return error
}

describe('components/Preview/loaders/useGate', () => {
  const logLevel = log.getLevel()
  beforeAll(() => {
    log.setLevel('silent')
  })
  afterAll(() => {
    log.setLevel(logLevel)
  })
  describe('gate', () => {
    describe('handles deleted', () => {
      it('using DeleteMarker', () => {
        const s3 = mockS3(() => ({ DeleteMarker: true }))
        return expect(gate({ s3, handle })).rejects.toMatchObject(
          PreviewError.Deleted({ handle }),
        )
      })
      it('using status code', () => {
        const s3 = mockS3(() => {
          throw mockAWSError(405)
        })
        return expect(gate({ s3, handle })).rejects.toMatchObject(
          PreviewError.Deleted({ handle }),
        )
      })
      it('using http header', () => {
        const s3 = mockS3(
          () => {
            throw mockAWSError('NotFound')
          },
          {
            response: {
              httpResponse: {
                headers: {
                  'x-amz-delete-marker': 'true',
                },
              },
            },
          },
        )
        return expect(gate({ s3, handle })).rejects.toMatchObject(
          PreviewError.Deleted({ handle }),
        )
      })
    })
    describe('handles archived', () => {
      it('using glacier storage class', () => {
        const s3 = mockS3(() => ({ StorageClass: 'GLACIER' }))
        return expect(gate({ s3, handle })).rejects.toMatchObject(
          PreviewError.Archived({ handle }),
        )
      })
      it('handles deep archive storage class', () => {
        const s3 = mockS3(() => ({ StorageClass: 'DEEP_ARCHIVE' }))
        return expect(gate({ s3, handle })).rejects.toMatchObject(
          PreviewError.Archived({ handle }),
        )
      })
    })
    describe('handles not found', () => {
      it('using NotSuchKey code', () => {
        const s3 = mockS3(() => {
          throw createError('NoSuchKey')
        })
        return expect(gate({ s3, handle })).rejects.toMatchObject(
          PreviewError.DoesNotExist({ handle }),
        )
      })
      it('using NotFound code', () => {
        const s3 = mockS3(() => {
          throw createError('NotFound')
        })
        return expect(gate({ s3, handle })).rejects.toMatchObject(
          PreviewError.DoesNotExist({ handle }),
        )
      })
    })
    it('handles regular errors', () => {
      const error = new Error()
      const s3 = mockS3(() => {
        throw error
      })
      return expect(gate({ s3, handle })).rejects.toThrow(error)
    })
    it('handles bad request', () => {
      const s3 = mockS3(() => {
        throw mockAWSError('BadRequest')
      })
      return expect(gate({ s3, handle })).rejects.toMatchObject(
        PreviewError.InvalidVersion({ handle }),
      )
    })
    it('handles auto fetch threshold', () => {
      const s3 = mockS3(() => ({ ContentLength: 1000 }))
      return expect(
        gate({ s3, handle, thresholds: { autoFetch: 100 } }),
      ).rejects.toMatchObject(PreviewError.TooLarge({ handle }))
    })
    it('handles never fetch threshold', () => {
      const s3 = mockS3(() => ({ ContentLength: 1000 }))
      return expect(gate({ s3, handle, thresholds: { neverFetch: 100 } })).resolves.toBe(
        true,
      )
    })
  })
})
