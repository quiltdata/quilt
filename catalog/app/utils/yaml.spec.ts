import { describe, it, expect } from 'vitest'

import * as yaml from './yaml'

describe('utils/yaml', () => {
  it('keeps date-like values as strings with the core schema', () => {
    const v = yaml.parseStrict<Record<string, unknown>>('d: 2024-01-01\n', {
      schema: 'core',
    })
    expect(v).toEqual({ d: '2024-01-01' })
    expect(yaml.stringify(v as any)).toBe("d: '2024-01-01'\n")
  })
})
