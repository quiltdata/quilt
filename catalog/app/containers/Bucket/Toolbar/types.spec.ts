import { describe, it, expect } from 'vitest'

import { DirHandleCreate } from './types'

describe('containers/Bucket/Toolbar/types', () => {
  describe('DirHandleCreate', () => {
    it('ensures DirHandleCreate creates the handle with trailing "/" in path', () => {
      const bucket = 'test-bucket'

      expect(DirHandleCreate(bucket, 'folder/subfolder').path).toBe('folder/subfolder/')
      expect(DirHandleCreate(bucket, 'folder/subfolder/').path).toBe('folder/subfolder/')
      expect(DirHandleCreate(bucket, '').path).toBe('')
    })

    it('ensures DirHandleCreate normalizes invalid path with leading slash', () => {
      const bucket = 'test-bucket'
      expect(DirHandleCreate(bucket, '/folder/').path).toBe('folder/')
      expect(DirHandleCreate(bucket, '/').path).toBe('')
    })
  })
})
