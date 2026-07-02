import { matchPath } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

import { bucketPackageAddFiles, dataProduct, dataProductTree } from './routes'

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

  describe('dataProduct', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = dataProduct

      const id = 'dp-42'

      const generatedUrl = url(id)
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { id: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.id).toBe(id)
    })
  })

  describe('dataProductTree', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = dataProductTree

      const id = 'dp-42'
      const treePath = 'sub/dir/file.csv'

      const generatedUrl = url(id, treePath)
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { id: string; path?: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.id).toBe(id)
      expect(match?.params?.path).toBe(treePath)
    })
  })
})
