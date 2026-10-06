import { describe, expect, it } from 'vitest'

import { currentWiring, rulePattern, ruleName } from './EventWiring'

describe('containers/Admin/Buckets/EventWiring', () => {
  it('reads the mode the bucket record encodes', () => {
    expect(currentWiring(null)).toEqual({ kind: 'unconfigured' })
    expect(currentWiring('DO_NOT_SUBSCRIBE')).toEqual({ kind: 'skipped' })
    expect(
      currentWiring('arn:aws:sns:us-east-1:123456789012:b-QuiltNotifications-abc'),
    ).toEqual({
      kind: 'topic',
      arn: 'arn:aws:sns:us-east-1:123456789012:b-QuiltNotifications-abc',
      region: 'us-east-1',
      account: '123456789012',
      managed: true,
    })
    expect(currentWiring('arn:aws:sns:eu-west-1:210987654321:fanout')).toMatchObject({
      managed: false,
      account: '210987654321',
    })
    expect(
      currentWiring('arn:aws-us-gov:sns:us-gov-west-1:210987654321:t'),
    ).toMatchObject({
      region: 'us-gov-west-1',
    })
    expect(currentWiring('')).toEqual({ kind: 'unconfigured' })
    expect(currentWiring('not-an-arn')).toEqual({ kind: 'unparsed', arn: 'not-an-arn' })
  })

  it('keeps .quilt/ in a prefix-scoped rule', () => {
    expect(rulePattern('b', ['data/']).detail).toEqual({
      bucket: { name: ['b'] },
      object: { key: [{ prefix: 'data/' }, { prefix: '.quilt/' }] },
    })
    expect(rulePattern('b', ['.quilt/']).detail).toEqual({
      bucket: { name: ['b'] },
      object: { key: [{ prefix: '.quilt/' }] },
    })
    expect(rulePattern('b', null).detail).toEqual({ bucket: { name: ['b'] } })
    expect(rulePattern('b', ['']).detail).toEqual({ bucket: { name: ['b'] } })
  })

  it('names rules within the 64-char limit', () => {
    const name = ruleName('a'.repeat(63), 's'.repeat(128))
    expect(name.length).toBeLessThanOrEqual(64)
    expect(name).toMatch(/^[.\-_A-Za-z0-9]+$/)
    expect(ruleName('x')).toMatch(/^[.\-_A-Za-z0-9]+$/)
    expect(ruleName('x')).toBe(ruleName('x'))
    expect(ruleName('x')).not.toBe(ruleName('y'))
  })
})
