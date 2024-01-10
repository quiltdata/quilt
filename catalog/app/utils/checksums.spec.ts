import fs from 'fs'
import path from 'path'
import util from 'util'

import computeFileChecksumLimit from './checksums'

jest.mock(
  'constants/config',
  jest.fn(() => ({
    multipartChecksums: true,
  })),
)

describe('utils/checksums', () => {
  describe('computeFileChecksumLimit, multipart hashing', () => {
    test('Test singlepart hashing', async () => {
      // Package manifest: https://open.quiltdata.com/b/allencell/tree/.quilt/packages/7acdd948d565d1f22c10f0d5ec4ae99742f04a4849c5e1498f252a0ac1ddeb04
      // File in that package: https://open.quiltdata.com/b/allencell/tree/aics/wtc11_short_read_genome_sequence/README.md?version=qt7oZnXdqJ0vokH1MpXksOiwgqOPPHV2
      const fileContents = '# This is a test package\n'
      const file = new File([Buffer.from(fileContents)], 'junk/s3.js')
      await expect(computeFileChecksumLimit(file)).resolves.toEqual({
        value: 'e5c0b36103e96037f4892e73e457ad62753c1c5ad50c3bb0610fad268666f1ea',
        type: 'SHA256',
      })
    })
    test('Test multipart >8Mb hashing', async () => {
      const readFile = util.promisify(fs.readFile)
      const contents = await readFile(path.join(__dirname, './checksums-11mb-test.png'))
      const file = new File(
        [contents],
        'master/diagnosticsheets/diagnostic_sheets/ProteinDisplayName_Alpha-actinin-1_1.png',
      )
      await expect(computeFileChecksumLimit(file)).resolves.toEqual({
        value: '7y6ba70KDRATjq9HezYMTKLluvYXP5g+CSJL9EwnjiY=-2',
        type: 'QuiltMultipartSHA256',
      })
    })
  })
})
