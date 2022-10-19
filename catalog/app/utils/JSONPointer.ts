export type Path = (string | number)[]

export type Pointer = string

export function stringify(addressPath: Path): string {
  return `/${addressPath.join('/')}`
}

export function parse(address: Pointer) {
  return address.slice(1).split('/')
}
