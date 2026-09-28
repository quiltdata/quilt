import { matchPath } from 'react-router-dom'
import { describe, it, expect } from 'vitest'

import {
  adminRoleDetail,
  adminUserDetail,
  bucketPackageAddFiles,
  queriesAthena,
  queriesAthenaExecution,
  queriesAthenaWorkgroup,
} from './routes'

describe('constants/routes', () => {
  // The route table is not typechecked (App.jsx is untyped), and a detail route whose
  // `url` does not match its own `path` fails only at runtime, as a redirect to the
  // list with no error.
  describe('adminUserDetail', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = adminUserDetail
      const userName = 'some_user1'
      const { pathname } = new URL(url(userName), 'http://localhost')
      const match = matchPath<{ userName: string }>(pathname, {
        path,
        exact: true,
        strict: true,
      })
      expect(match?.params?.userName).toBe(userName)
    })

    it('does not swallow the users list route', () => {
      expect(
        matchPath('/admin', { path: adminUserDetail.path, exact: true, strict: true }),
      ).toBeNull()
    })
  })

  describe('adminRoleDetail', () => {
    it('pathname created by `url` should match `path`', () => {
      const { path, url } = adminRoleDetail
      const roleId = '7f3c1e20-0000-4a11-9b77-2b4d5e6f7a80'
      const { pathname } = new URL(url(roleId), 'http://localhost')
      const match = matchPath<{ roleId: string }>(pathname, {
        path,
        exact: true,
        strict: true,
      })
      expect(match?.params?.roleId).toBe(roleId)
    })
  })

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

    it('carries the tabulator deep-link params in the search string', () => {
      const { url } = queriesAthenaWorkgroup

      const generatedUrl = url('primary', { bucket: 'my-bucket', table: 'drugs' })
      const { searchParams } = new URL(generatedUrl, 'http://localhost')

      expect(Object.fromEntries(searchParams.entries())).toEqual({
        bucket: 'my-bucket',
        table: 'drugs',
      })
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

    // The type forbids `table`, but `queryRedirects.jsx` is untyped, so the drop
    // has to hold at runtime: TabulatorTables' autofill would overwrite the
    // editor's SQL with a SELECT unrelated to the execution on screen.
    it('carries the bucket scope and drops a `table` passed anyway', () => {
      const { url } = queriesAthenaExecution

      const opts = { bucket: 'my-bucket', table: 'drugs' }
      const generatedUrl = url('primary', 'abc-123', opts as { bucket?: string })
      const { searchParams } = new URL(generatedUrl, 'http://localhost')

      expect(Object.fromEntries(searchParams.entries())).toEqual({ bucket: 'my-bucket' })
    })
  })
})
