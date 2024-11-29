import type { S3 } from 'aws-sdk'

import { objectVersions } from './object'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

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
    it('return object versions', () => {
      expect(
        objectVersions({ s3: s3 as S3, bucket: 'any', path: 'foo' }),
      ).resolves.toMatchSnapshot()
    })
  })
})
