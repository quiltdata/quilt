import { matchPath } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

import {
  bucketPackageAddFiles,
  dataProduct,
  dataProductObjects,
  dataProductPackage,
  dataProductPackages,
} from './routes'

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

  describe('dataProductObjects', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = dataProductObjects

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

  describe('dataProductPackages', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = dataProductPackages

      const id = 'dp-42'

      const generatedUrl = url(id)
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { id: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.id).toBe(id)
    })
  })

  describe('dataProductPackage', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = dataProductPackage

      const id = 'dp-42'
      const pkg = 'hurricanes'
      const treePath = 'sub/dir/file.csv'

      const generatedUrl = url(id, pkg, treePath)
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { id: string; pkg: string; path?: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.id).toBe(id)
      expect(match?.params?.pkg).toBe(pkg)
      expect(match?.params?.path).toBe(treePath)
    })

    it('keeps a virtual name containing slashes in a single param', () => {
      const { path, url } = dataProductPackage

      const id = 'dp-42'
      const pkg = 'group/dataset'

      const generatedUrl = url(id, pkg)
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { id: string; pkg: string; path?: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.id).toBe(id)
      // react-router does not decode params, so the encoded segment round-trips
      // back to the original name only after decodeURIComponent.
      expect(decodeURIComponent(match?.params?.pkg ?? '')).toBe(pkg)
    })

    it('matches the package root (empty inner path)', () => {
      const { path, url } = dataProductPackage

      const generatedUrl = url('dp-42', 'hurricanes')
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { id: string; pkg: string; path?: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.pkg).toBe('hurricanes')
      expect(match?.params?.path ?? '').toBe('')
    })
  })
})
