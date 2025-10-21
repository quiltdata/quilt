import { DirHandleCreate } from './types'

describe('containers/Bucket/Toolbar/types', () => {
  describe('DirHandleCreate', () => {
    it('ensures DirHandleCreate creates the handle with trailing "/" in path', () => {
      const bucket = 'test-bucket'

      expect(DirHandleCreate(bucket, 'folder/subfolder').path).toBe('folder/subfolder/')
      expect(DirHandleCreate(bucket, 'folder/subfolder/').path).toBe('folder/subfolder/')
      expect(DirHandleCreate(bucket, '').path).toBe('/')
    })
  })
})
