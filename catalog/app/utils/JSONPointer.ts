export type Path = (number | string)[]

export type Pointer = string

type JsonPathExpression = string

function encodeFragment(fragment: Path[number]) {
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

export function toJsonPath(address: Path | Pointer): JsonPathExpression {
  if (!Array.isArray(address)) return toJsonPath(parse(address))

  // `/a/b/c` → `$..['a']['b']['c']`
  // `/sp ace/da-sh/$$$` → `$..['sp ace']['da-sh']['$$$']`
  return `$..${address.map((fragment) => `['${fragment}']`).join('')}`
}
