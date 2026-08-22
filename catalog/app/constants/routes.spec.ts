import { matchPath } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

import {
  bucketPackageAddFiles,
  queriesAthena,
  queriesAthenaExecution,
  queriesAthenaWorkgroup,
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

  describe('queriesAthena', () => {
    it('carries the tabulator deep-link params in the search string', () => {
      const { path, url } = queriesAthena

      const generatedUrl = url({ bucket: 'my-bucket', table: 'drugs' })
      const { pathname, searchParams } = new URL(generatedUrl, 'http://localhost')

      expect(matchPath(pathname, { path, exact: true })).toBeTruthy()
      expect(Object.fromEntries(searchParams.entries())).toEqual({
        bucket: 'my-bucket',
        table: 'drugs',
      })
    })
  })

  describe('queriesAthenaWorkgroup', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = queriesAthenaWorkgroup

      const workgroup = 'primary'

      const generatedUrl = url(workgroup)
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { workgroup: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.workgroup).toBe(workgroup)
    })
  })

  describe('queriesAthenaExecution', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = queriesAthenaExecution

      const workgroup = 'primary'
      const queryExecutionId = 'abc-123'

      const generatedUrl = url(workgroup, queryExecutionId)
      const { pathname } = new URL(generatedUrl, 'http://localhost')

      type MatchParams = { workgroup: string; queryExecutionId: string }
      const match = matchPath<MatchParams>(pathname, { path, exact: true })

      expect(match?.params?.workgroup).toBe(workgroup)
      expect(match?.params?.queryExecutionId).toBe(queryExecutionId)
    })
  })
})
