import { describe, it, expect } from 'vitest'

import * as S3Tags from './s3Tags'

describe('utils/s3Tags', () => {
  const config = S3Tags.parseConfig({ tags: { project: '/project', stage: '/a/stage' } })

  it('rejects configs without a tags map, or with bad keys and pointers', () => {
    expect(() => S3Tags.parseConfig({})).toThrow()
    expect(() => S3Tags.parseConfig({ tags: { 'aws:x': '/x' } })).toThrow(/reserved/)
    expect(() => S3Tags.parseConfig({ tags: { x: 'x' } })).toThrow(/JSON pointer/)
    const eleven = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`k${i}`, '/x']),
    )
    expect(() => S3Tags.parseConfig({ tags: eleven })).toThrow(/at most 10/)
  })

  it('projects scalar values and flags the rest', () => {
    expect(S3Tags.project(config, { project: 'apollo', a: { stage: 3 } })).toEqual([
      { key: 'project', pointer: '/project', value: 'apollo' },
      { key: 'stage', pointer: '/a/stage', value: '3' },
    ])
    const [obj, bad] = S3Tags.project(config, { project: { x: 1 }, a: { stage: 'a;b' } })
    expect(obj.error).toBeTruthy()
    expect(bad.error).toBeTruthy()
  })

  it('keeps foreign tags, replaces owned ones and drops owned ones without a value', () => {
    const projected = S3Tags.project(config, { project: 'apollo' })
    expect(
      S3Tags.merge(config, projected, { owner: 'ops', project: 'old', stage: 'dev' }),
    ).toEqual({ owner: 'ops', project: 'apollo' })
  })

  it("keeps an owned tag its new value can't replace, and foreign tags named like Object props", () => {
    const projected = S3Tags.project(config, { project: { x: 1 } })
    expect(S3Tags.merge(config, projected, { project: 'old', constructor: 'x' })).toEqual(
      {
        project: 'old',
        constructor: 'x',
      },
    )
  })

  it("doesn't copy inherited Object props into the tag set", () => {
    const own = S3Tags.parseConfig({ tags: { constructor: '/c' } })
    const projected = S3Tags.project(own, { c: { x: 1 } })
    expect(S3Tags.merge(own, projected, {})).toEqual({})
  })
})
