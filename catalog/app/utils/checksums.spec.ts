import computeFileChecksumLimit from './checksums'

describe('utils/checksums', () => {
  describe('computeFileChecksumLimit', () => {
    test('test', async () => {
      const fileContents = `document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('s3').textContent = 'Yes!'
})

`
      const file = new File([Buffer.from(fileContents)], 'junk/s3.js')
      await expect(computeFileChecksumLimit(file)).resolves.toEqual({
        value: '8f843e82ea8248383fac42cdf9419955d0c7371e18665abb97e0d4ff02048f36',
        type: 'SHA256',
      })
    })
  })
})
