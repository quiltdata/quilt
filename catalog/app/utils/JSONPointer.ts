export type Path = (number | string)[]

export type Pointer = string

function encodeFragment(fragment: number | string) {
  return fragment.toString().replaceAll('~', '~0').replaceAll('/', '~1')
}

function decodeFragment(fragment: string) {
  return fragment.replaceAll('~1', '/').replaceAll('~0', '~')
}

export function stringify(addressPath: Readonly<Path>): Pointer {
  return `/${addressPath.map(encodeFragment).join('/')}`
}

export function parse(address: Pointer): Path {
  return address.slice(1).split('/').map(decodeFragment)
}

export function toJsonPath(address: Path | Pointer): string {
  if (Array.isArray(address)) {
    return `$.${address.join('.')}`
  }
  return `$${address.replace(/\//g, '.')}`
}
