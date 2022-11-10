import { parseResponse } from './Ngl'

const fileA = `fileA.sdf
Molecule A description

1 2 3 4 V2000
`

const fileB = `fileB.sdf
Molecule B description

0 0 0 0 0 999 V3000
M V30 BEGIN CTAB
M V30 END CTAB
M END
`

const fileBConverted = `
Actelion Java MolfileCreator 1.0

  0  0  0  0  0  0  0  0  0  0999 V2000
M  END
`

const fileC = `fileC.sdf
Molecule C description

1 2 3 4 V2000
`

const compoundFile = `${fileA}
$$$$

${fileB}

$$$$
${fileC}
$$$$`

describe('components/Preview/loaders/Ngl', () => {
  describe('parseResponse', () => {
    it('parses single file', async () => {
      const result = [
        {
          file: `${fileA}$$$$\n`,
          ext: 'sdf',
        },
      ]
      expect(await parseResponse(fileA, { bucket: '', key: 'fileA.sdf' })).toMatchObject(
        result,
      )
      expect(
        await parseResponse(Buffer.from(fileA), { bucket: '', key: 'fileA.sdf' }),
      ).toMatchObject(result)
    })
    it('parses multiple files', async () => {
      const result = [
        {
          file: `${fileA}$$$$\n`,
          ext: 'sdf',
        },
        {
          file: `${fileBConverted}`,
          ext: 'mol',
        },
        {
          file: `${fileC}$$$$\n`,
          ext: 'sdf',
        },
      ]
      expect(
        await parseResponse(compoundFile, { bucket: '', key: 'fileCompound.sdf' }),
      ).toMatchObject(result)
      expect(
        await parseResponse(Buffer.from(compoundFile), {
          bucket: '',
          key: 'fileCompound.sdf',
        }),
      ).toMatchObject(result)
    })
  })
})
