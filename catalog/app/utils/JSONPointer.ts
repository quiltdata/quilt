export type Path = (number | string)[]

export type Pointer = string

export function stringify(addressPath: Path): Pointer {
  return `/${addressPath.join('/')}`
}

export function parse(address: Pointer): Path {
  return address.slice(1).split('/')
}
