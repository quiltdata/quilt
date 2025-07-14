import { Json, JsonArray, JsonRecord } from 'utils/types'

export type Path = (number | string)[]

export type Pointer = string

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

const isJsonArray = (obj: Json): obj is JsonArray =>
  typeof obj === 'object' && Array.isArray(obj)

function getValueByPath(obj: JsonRecord, path: Path): Json {
  return path.reduce((memo: Json, key) => {
    if (memo === null || typeof memo !== 'object') {
      throw new Error(`Path "${stringify(path)}" not found in object`)
    }
    if (isJsonArray(memo)) return memo[parseInt(key.toString(), 10)]
    return memo[key.toString()]
  }, obj)
}

export function getValue(obj: JsonRecord, address: Path | Pointer): Json {
  if (!Array.isArray(address)) return getValue(obj, parse(address))

  return getValueByPath(obj, address)
}
