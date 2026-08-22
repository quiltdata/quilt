import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'
import dedent from 'dedent'

import { FileNotFound } from 'containers/Bucket/errors'
import Log from 'utils/Logging'
import * as Request from 'utils/useRequest'
import type { Successor } from 'utils/workflows'

import useSuccessors from './useSuccessors'

vi.mock('constants/config', () => ({ default: {} }))

// Create a stable S3 client instance
const s3 = {
  headObject: vi.fn(() => ({ promise: () => Promise.resolve({}) })),
  getObject: vi.fn(),
}

vi.mock('utils/AWS', () => ({ S3: { use: () => s3 } }))

describe('useSuccessors integration tests', () => {
  const CURRENT_BUCKET = 'foo-bucket'

  const SUCCESSOR_FOR_CURRENT_BUCKET = {
    copyData: true,
    name: CURRENT_BUCKET,
    slug: CURRENT_BUCKET,
    url: `s3://${CURRENT_BUCKET}`,
  }

  // Helper function to mock S3 getObject to return YAML config
  const mockS3ConfigYaml = (yamlString: string) => {
    s3.getObject.mockReturnValue({
      promise: () =>
        Promise.resolve({
          Body: Buffer.from(yamlString, 'utf-8'),
        }),
    })
  }

  describe('useRequest states', () => {
    it('should return Loading while request is in progress', async () => {
      s3.getObject.mockReturnValue({
        promise: () => new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
      })

      const { result } = renderHook(() => useSuccessors(CURRENT_BUCKET))

      expect(result.current).toBe(Request.Loading)
    })

    it('should return Error when request fails', async () => {
      const loglevel = Log.getLevel()
      Log.setLevel('silent')

      const testError = new Error('Network error')
      s3.getObject.mockReturnValue({
        promise: () => Promise.reject(testError),
      })

      const { result, waitForValueToChange } = renderHook(() =>
        useSuccessors(CURRENT_BUCKET),
      )

      await waitForValueToChange(() => result.current, { timeout: 5000 })
      expect(result.current).toBe(testError)

      Log.setLevel(loglevel)
    })
  })

  describe('when no successors are defined in workflow config', () => {
    it('should return empty successors (respect explicit config)', async () => {
      mockS3ConfigYaml(dedent`
        version: "1"
        workflows:
          workflow_1:
            name: Test Workflow
      `)

      const { result, waitForValueToChange } = renderHook(() =>
        useSuccessors(CURRENT_BUCKET),
      )
      await waitForValueToChange(() => result.current, { timeout: 5000 })

      expect(result.current).toEqual([])
    })

    it('should handle empty workflow config when file not found', async () => {
      s3.getObject.mockReturnValue({
        promise: () => Promise.reject(new FileNotFound('Object not found')),
      })

      const { result, waitForValueToChange } = renderHook(() =>
        useSuccessors(CURRENT_BUCKET),
      )

      await waitForValueToChange(() => result.current, { timeout: 5000 })
      expect(result.current).toEqual([SUCCESSOR_FOR_CURRENT_BUCKET])
    })

    it('should handle empty workflow config when file exists but is empty', async () => {
      mockS3ConfigYaml('')

      const { result, waitForValueToChange } = renderHook(() =>
        useSuccessors(CURRENT_BUCKET),
      )

      await waitForValueToChange(() => result.current, { timeout: 5000 })
      expect(result.current).toEqual([SUCCESSOR_FOR_CURRENT_BUCKET])
    })
  })

  describe('when successors are explicitly defined without current bucket', () => {
    it('should exclude current bucket and return only defined successors', async () => {
      mockS3ConfigYaml(dedent`
        version: "1"
        successors:
          s3://destination-bucket:
            title: Destination Bucket
            copy_data: true
          s3://another-bucket:
            title: Another Bucket
            copy_data: false
        workflows:
          workflow_1:
            name: Test Workflow
      `)

      const { result, waitForValueToChange } = renderHook(() =>
        useSuccessors(CURRENT_BUCKET),
      )
      await waitForValueToChange(() => result.current, { timeout: 5000 })

      expect(result.current).toEqual([
        {
          name: 'Destination Bucket',
          slug: 'destination-bucket',
          url: 's3://destination-bucket',
          copyData: true,
        },
        {
          name: 'Another Bucket',
          slug: 'another-bucket',
          url: 's3://another-bucket',
          copyData: false,
        },
      ])

      // Verify current bucket is not included
      expect(result.current).not.toContainEqual(
        expect.objectContaining({ slug: CURRENT_BUCKET }),
      )
    })
  })

  describe('when successors are explicitly defined with current bucket', () => {
    it('should return all defined successors without duplicating current bucket', async () => {
      mockS3ConfigYaml(dedent`
        version: "1"
        successors:
          s3://other-bucket:
            title: Other Bucket
          s3://${CURRENT_BUCKET}:
            title: Test Bucket (Current)
            copy_data: true
          s3://third-bucket:
            title: Third Bucket
            copy_data: false
        workflows:
          workflow_1:
            name: Test Workflow
      `)

      const { result, waitForValueToChange } = renderHook(() =>
        useSuccessors(CURRENT_BUCKET),
      )

      await waitForValueToChange(() => result.current, { timeout: 5000 })
      expect(result.current).toEqual([
        {
          copyData: true,
          name: 'Other Bucket',
          slug: 'other-bucket',
          url: 's3://other-bucket',
        },
        {
          copyData: true,
          name: 'Test Bucket (Current)',
          slug: CURRENT_BUCKET,
          url: `s3://${CURRENT_BUCKET}`,
        },
        {
          copyData: false,
          name: 'Third Bucket',
          slug: 'third-bucket',
          url: 's3://third-bucket',
        },
      ])

      // Verify current bucket is not duplicated
      const currentBucketMatches = (result.current as Successor[]).filter(
        (s) => s.slug === CURRENT_BUCKET,
      )
      expect(currentBucketMatches).toHaveLength(1)
    })
  })
})
