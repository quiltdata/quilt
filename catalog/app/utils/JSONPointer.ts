export type Path = string[] // TODO: (number | string)[]

export type Pointer = string

export function stringify(addressPath: Path): string {
  return `/${addressPath.join('/')}`
}

export function parse(address: Pointer) {
  return address
    .slice(1)
    .split('/')
    .map((x) => x.toString())
}
