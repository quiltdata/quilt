import { describe, it, expect, vi } from 'vitest'

import { addFormSpec, editFormSpec, validateObjectTagsConfig } from './BucketForm'

vi.mock('constants/config', () => ({ default: {} }))

describe('containers/Admin/Buckets: object tags mapping', () => {
  it('accepts an empty or valid mapping and explains an invalid one', () => {
    expect(validateObjectTagsConfig('')).toBeUndefined()
    expect(validateObjectTagsConfig('tags:\n  project: /project\n')).toBeUndefined()
    expect(validateObjectTagsConfig('tags:\n  aws:x: /x\n')).toMatch(/reserved/)
    expect(validateObjectTagsConfig('tags: [')).toBeTruthy()
  })

  it('sends the mapping on update, null when empty, and never on add', () => {
    expect(editFormSpec.objectTagsConfig({ objectTagsConfig: ' tags:\n  p: /p ' })).toBe(
      'tags:\n  p: /p',
    )
    expect(editFormSpec.objectTagsConfig({ objectTagsConfig: '  ' })).toBeNull()
    expect('objectTagsConfig' in addFormSpec).toBe(false)
  })
})
