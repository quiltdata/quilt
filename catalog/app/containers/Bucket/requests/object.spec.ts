import type { S3 } from 'aws-sdk'
import { describe, it, expect, vi } from 'vitest'

import { FileNotFound } from '../errors'

import { applyS3Tags, deleteObject, fetchFile, objectVersions } from './object'

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
    it('should not scope the delete to the handle version', async () => {
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
      })
    })
  })

  describe('applyS3Tags', () => {
    it('merges into the current version and skips what it must not tag', async () => {
      const putObjectTagging = vi.fn(() => ({ promise: () => Promise.resolve({}) }))
      const s3 = {
        headObject: ({ Key }: { Key: string }) => ({
          promise: () => Promise.resolve({ VersionId: Key === 'stale' ? 'v2' : 'v1' }),
        }),
        getObjectTagging: () => ({
          promise: () =>
            Promise.resolve({
              TagSet: [
                { Key: 'owner', Value: 'ops' },
                { Key: 'project', Value: 'old' },
              ],
            }),
        }),
        putObjectTagging,
      } as unknown as S3

      const result = await applyS3Tags({
        s3,
        config: { tags: { project: '/project' } },
        meta: { project: 'apollo' },
        bucket: 'b',
        physicalKeys: [
          's3://b/current?versionId=v1',
          's3://b/stale?versionId=v1',
          's3://b/unversioned',
          's3://other/x?versionId=v1',
        ],
      })

      expect(result.tagged).toBe(1)
      expect(result.skipped.map((s) => s.reason).sort()).toEqual([
        'No object version',
        'Not the current version of the object',
        'Outside the package bucket',
      ])
      expect(putObjectTagging).toHaveBeenCalledWith({
        Bucket: 'b',
        Key: 'current',
        Tagging: {
          TagSet: [
            { Key: 'owner', Value: 'ops' },
            { Key: 'project', Value: 'apollo' },
          ],
        },
      })
    })

    it("doesn't write a tag set that is already up to date", async () => {
      const putObjectTagging = vi.fn()
      const s3 = {
        headObject: () => ({ promise: () => Promise.resolve({ VersionId: 'v1' }) }),
        getObjectTagging: () => ({
          promise: () =>
            Promise.resolve({ TagSet: [{ Key: 'project', Value: 'apollo' }] }),
        }),
        putObjectTagging,
      } as unknown as S3

      const result = await applyS3Tags({
        s3,
        config: { tags: { project: '/project' } },
        meta: { project: 'apollo' },
        bucket: 'b',
        physicalKeys: ['s3://b/k?versionId=v1'],
      })

      expect(result).toEqual({ tagged: 0, unchanged: 1, skipped: [] })
      expect(putObjectTagging).not.toHaveBeenCalled()
    })
  })
})
