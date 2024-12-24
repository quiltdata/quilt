const openchem = import('openchemlib/minimal')

type ResponseFile = string | Uint8Array

export interface MolMeta {
  title: string
  source: string
  comment: string
}

interface Molecule {
  file: string
  ext: string
  meta: MolMeta
}

const readLines = (x: string) => x.split('\n')

function getMeta(content: string): MolMeta {
  const [title, source, comment] = readLines(content)
  return {
    title,
    source,
    comment,
  }
}

async function parseMolItem(content: string, ext: string): Promise<Molecule> {
  const meta = getMeta(content)
  if (content.indexOf('V3000') === -1) return { ext, file: content, meta }
  const { Molecule } = await openchem
  return {
    ext: 'mol',
    file: Molecule.fromMolfile(content.trim()).toMolfile(),
    meta,
  }
}

export async function parse(file: ResponseFile, ext: string): Promise<Molecule[]> {
  return Promise.all(
    file
      .toString()
      .split('$$$$')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((part) => parseMolItem(part, ext)),
  )
}
