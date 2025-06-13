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

function normalizeJsonPathSegment(fragment: Path[number]) {
  // Return number, convert to string later,
  // but the notation `$..123` for jsonpath is ok
  if (typeof fragment !== 'string') return fragment

  const valid = fragment.indexOf(' ') < 0 && fragment.indexOf('-') < 0
  if (valid) return fragment

  return `['${fragment}']`
}

export function toJsonPath(address: Path | Pointer): JsonPathExpression {
  if (!Array.isArray(address)) {
    return toJsonPath(address.split('/'))
  }
  return `$.${address.map(normalizeJsonPathSegment).join('.')}`.replace(
    /([^\.])\.\[/g,
    (_s, $1) => `${$1}[`,
  )
}
