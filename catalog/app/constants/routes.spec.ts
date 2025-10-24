import { matchPath } from 'react-router-dom'

import { bucketPackageAddFiles } from './routes'

describe('constants/routes', () => {
  describe('bucketPackageAddFiles', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = bucketPackageAddFiles

      const bucket = 'my-bucket'
      const packageName = 'user/my-package'
      const files = {
        'config.yml': 's3://bucket/config.yml',
        'src/main.py': 's3://bucket/src/main.py',
      }

      const generatedUrl = url(bucket, packageName, files)
      const { pathname, searchParams } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { bucket: string; name: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.bucket).toBe(bucket)
      expect(match?.params?.name).toBe(packageName)
      expect(Object.fromEntries(searchParams.entries())).toEqual(files)
    })
  })
})
