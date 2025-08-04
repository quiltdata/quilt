import fs from 'fs'
import path from 'path'
import util from 'util'

import computeFileChecksumLimit from './checksums'

jest.mock(
  'constants/config',
  jest.fn(() => ({
    chunkedChecksums: false,
  })),
)

describe('utils/checksums', () => {
  describe('computeFileChecksumLimit, plain (legacy)', () => {
    it('produces a correct checksum given an empty file', async () => {
      const file = new File([], 'empty')
      await expect(computeFileChecksumLimit(file)).resolves.toEqual({
        value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        type: 'SHA256',
      })
    })
    it('produces a correct checksum given a file with the size below the threshold', async () => {
      // Package manifest: https://open.quiltdata.com/b/allencell/tree/.quilt/packages/7acdd948d565d1f22c10f0d5ec4ae99742f04a4849c5e1498f252a0ac1ddeb04
      // File in that package: https://open.quiltdata.com/b/allencell/packages/aics/wtc11_short_read_genome_sequence/tree/7acdd948d565d1f22c10f0d5ec4ae99742f04a4849c5e1498f252a0ac1ddeb04/README.md
      const fileContents = '# This is a test package\n'
      const file = new File([Buffer.from(fileContents)], 'junk/s3.js')
      await expect(computeFileChecksumLimit(file)).resolves.toEqual({
        value: 'e5c0b36103e96037f4892e73e457ad62753c1c5ad50c3bb0610fad268666f1ea',
        type: 'SHA256',
      })
    })
    it('produces a correct checksum given a file with the size above the threshold', async () => {
      // Package manifest: https://open.quiltdata.com/b/allencell/tree/.quilt/packages/38886848f1bad99396b96157101dd52520fa6aae0479adb9de4bde2b12997d92
      // File in that package: https://open.quiltdata.com/b/allencell/packages/aics/actk/tree/38886848f1bad99396b96157101dd52520fa6aae0479adb9de4bde2b12997d92/master/diagnosticsheets/diagnostic_sheets/ProteinDisplayName_Alpha-actinin-1_1.png
      const readFile = util.promisify(fs.readFile)
      const contents = await readFile(path.join(__dirname, './checksums-11mb-test.png'))
      const file = new File(
        [contents],
        'master/diagnosticsheets/diagnostic_sheets/ProteinDisplayName_Alpha-actinin-1_1.png',
      )
      await expect(computeFileChecksumLimit(file)).resolves.toEqual({
        value: '8fd93402941dead341a75ac813d4894e9121ac3ee4107adfd5848ec09a318c84',
        type: 'SHA256',
      })
    })
  })
})
