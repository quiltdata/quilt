const openchem = import('openchemlib/minimal')

type ResponseFile = string | Uint8Array

async function parseMolItem(
  content: string,
  ext: string,
): Promise<{ file: ResponseFile; ext: string }> {
  if (content.indexOf('V3000') === -1) return { ext, file: content }
  const { Molecule } = await openchem
  return {
    ext: 'mol',
    file: Molecule.fromMolfile(content.trim()).toMolfile(),
  }
}

export default async function parseMol(
  file: ResponseFile,
  ext: string,
): Promise<{ file: ResponseFile; ext: string }[]> {
  return Promise.all(
    file
      .toString()
      .split('$$$$')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((part) => parseMolItem(part, ext)),
  )
}
