import * as R from 'ramda'
import { describe, expect, it, vi } from 'vitest'

import type * as Model from 'model'
import type { JsonRecord } from 'utils/types'

import {
  createObjectUrlsSigner,
  createPathResolver,
  createUrlProcessor,
} from './useSignObjectUrls'

vi.mock('constants/config', () => ({ default: {} }))

describe('components/Preview/loaders/useSignObjectUrls', () => {
  describe('createObjectUrlsSigner', () => {
    const traverseUrls = (fn: (v: string) => string, obj: JsonRecord) =>
      R.evolve(
        {
          foo: {
            bar: fn,
            foo: {
              baz: fn,
            },
          },
        },
        obj,
      )
    const processUrl = async (path: string) => path.split('').reverse().join('')
    let object = {
      check: true,
      foo: {
        bar: 'FEDCBA',
        foo: {
          baz: '987654321',
        },
      },
    }
    it('should return strings', () => {
      let processor = createObjectUrlsSigner(traverseUrls, processUrl, false)
      return expect(processor(object)).resolves.toEqual({
        check: true,
        foo: {
          bar: 'ABCDEF',
          foo: {
            baz: '123456789',
          },
        },
      })
    })

    it('should return async functions', async () => {
      let processor = createObjectUrlsSigner(traverseUrls, processUrl, true)
      const result = await processor(object)
      let bar = (result.foo as any).bar
      let baz = (result.foo as any).foo.baz
      await expect(bar()).resolves.toBe('ABCDEF')
      await expect(baz()).resolves.toBe('123456789')
    })
  })

  describe('createUrlProcessor', () => {
    let sign = ({ bucket, key, version }: Model.S3.S3ObjectLocation) =>
      `https://${bucket}+${key}+${version}`
    let resolvePath = async (path: string) => ({
      bucket: 'resolved-bucket',
      key: path,
    })
    let processUrl = createUrlProcessor(sign, resolvePath, { bucket: 'foo', key: 'bar' })
    it('should return unsinged web', () =>
      expect(processUrl('http://bucket/path')).resolves.toBe('http://bucket/path'))
    it('should return signed S3 URL', () =>
      expect(processUrl('s3://bucket/path')).resolves.toBe(
        'https://bucket+path+undefined',
      ))
    it('should return signed S3 relative URL', () =>
      expect(processUrl('s3://./relative/path')).resolves.toBe(
        'https://resolved-bucket+./relative/path+undefined',
      ))
    it('should return signed path', () =>
      expect(processUrl('./relative/path')).resolves.toBe(
        'https://resolved-bucket+./relative/path+undefined',
      ))
  })

  describe('createPathResolver', () => {
    it('Join keys if no logical key', () => {
      const resolveKey = (key: string) => ({
        bucket: 'foo/bar',
        key: `CCC/${key}`,
      })
      let resolve = createPathResolver(resolveKey, { bucket: 'foo/bar', key: 'AAA/' })
      return expect(resolve('BBB')).resolves.toEqual({
        bucket: 'foo/bar',
        key: 'AAA/BBB',
      })
    })
    it('Resovle logical key', () => {
      const resolveLogicalKey = (key: string) => ({
        bucket: 'foo/bar',
        key: `CCC/${key}`,
      })
      let resolve = createPathResolver(resolveLogicalKey, {
        bucket: 'foo/bar',
        key: 'AAA/',
        logicalKey: 'AAA/',
      })
      return expect(resolve('BBB')).resolves.toEqual({
        bucket: 'foo/bar',
        key: 'CCC/AAA/BBB',
      })
    })
  })
})
