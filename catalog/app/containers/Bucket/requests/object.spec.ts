import type { S3 } from 'aws-sdk'
import { vi } from 'vitest'

import { FileNotFound } from '../errors'

import { deleteObject, fetchFile, objectVersions } from './object'

class AWSError extends Error {
  code: string

  constructor(code: string, message?: string) {
    super(message)
    this.code = code
  }
}

vi.mock('constants/config', () => ({ default: {} }))

describe('app/containers/Bucket/requests/object', () => {
  describe('objectVersions', () => {
    const s3 = {
      listObjectVersions: () => ({
        promise: () =>
          Promise.resolve({
            Versions: [
              {
                Key: 'foo',
                LastModified: new Date(1732811111111),
                Size: 1,
                VersionId: 'earlier date later',
              },
              { Key: 'foo', Size: 1, VersionId: 'essential' },
              { Key: 'foo', Size: 1 }, // without version
              { Key: 'foo', IsLatest: true, VersionId: 'latest', Size: 1 },
              {
                Key: 'foo',
                Size: 1,
                StorageClass: 'GLACIER',
                VersionId: 'archived glacier',
              },
              {
                Key: 'foo',
                Size: 1,
                StorageClass: 'DEEP_ARCHIVE',
                VersionId: 'deep archived',
              },
              {
                Key: 'foo',
                LastModified: new Date(1732855555555),
                Size: 1,
                VersionId: 'later date first',
              },
              { Key: 'foo', VersionId: 'marked as deleted because no `Size`' },
              { Key: 'drop' },
            ],
            DeleteMarkers: [
              { Key: 'foo', VersionId: 'deleted' },
              {
                Key: 'foo',
                LastModified: new Date(1732899999999),
                VersionId: 'deleted, but the most recent',
              },
            ],
          } as S3.Types.ListObjectVersionsOutput),
      }),
    }
    it('return object versions', () =>
      expect(
        objectVersions({ s3: s3 as S3, bucket: 'any', path: 'foo' }),
      ).resolves.toMatchSnapshot())
  })

  describe('fetchFile', () => {
    const s3 = {
      getObject: () => ({
        promise: () =>
          Promise.resolve({
            Body: Buffer.from('{"foo": "bar"}'),
          } as S3.Types.GetObjectOutput),
      }),
      headObject: ({ Key }: S3.Types.HeadObjectRequest) => ({
        // AWS Request has no `.response` field type
        // but it has this in practice, and we use it
        response: { httpResponse: { headers: {} } },
        promise: () => {
          switch (Key) {
            case 'does-not-exist':
              return Promise.reject(new AWSError('NotFound'))
            case 'exist':
              return Promise.resolve({
                VersionId: 'resolved',
              } as S3.Types.HeadObjectOutput)
            default:
              return Promise.reject(new Error())
          }
        },
      }),
    }

    it('fetches existing file', async () => {
      const result = await fetchFile({
        // `.response` is absent in type
        // @ts-expect-error
        s3: s3 as S3,
        handle: { bucket: 'b', key: 'exist' },
      })
      expect(result.handle).toMatchObject({
        bucket: 'b',
        key: 'exist',
        version: 'resolved',
      })
      expect(result.body?.toString()).toBe('{"foo": "bar"}')
    })

    it('throws when file not found', async () => {
      const result = fetchFile({
        // `.response` is absent in type
        // @ts-expect-error
        s3: s3 as S3,
        handle: { bucket: 'b', key: 'does-not-exist' },
      })
      return expect(result).rejects.toThrow(FileNotFound)
    })

    it('re-throws on error', async () => {
      const result = fetchFile({
        // `.response` is absent in type
        // @ts-expect-error
        s3: s3 as S3,
        handle: { bucket: 'b', key: 'error' },
      })
      return expect(result).rejects.toThrow(Error)
    })
  })

  describe('deleteObject', () => {
    it('should call S3 deleteObject with correct parameters', async () => {
      const mockDeleteObject = vi.fn(() => ({
        promise: () => Promise.resolve(),
      }))

      const s3 = {
        deleteObject: mockDeleteObject,
      } as unknown as S3

      const handle = {
        bucket: 'test-bucket',
        key: 'test-key',
        version: 'test-version',
      }

      await deleteObject({ s3, handle })

      expect(mockDeleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key',
        VersionId: 'test-version',
      })
    })
  })
})
