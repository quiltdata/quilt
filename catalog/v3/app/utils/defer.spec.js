import defer from './defer'

describe('utils/defer', () => {
  it('when calling resolve the promise should be resolved', async () => {
    const { resolver, promise } = defer()
    const expected = 'test'
    resolver.resolve(expected)
    const actual = await promise
    expect(actual).toBe(expected)
  })

  it('when calling reject the promise should be rejected', async () => {
    const { resolver, promise } = defer()
    const expected = new Error('test')
    resolver.reject(expected)
    try {
      await promise
      throw new Error('shouldnt be here')
    } catch (actual) {
      expect(actual).toBe(expected)
    }
  })
})
