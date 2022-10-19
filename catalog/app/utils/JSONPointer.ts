export function stringify(addressPath: (string | number)[]): string {
  return `/${addressPath.join('/')}`
}

export function parse(address: string) {
  return address.slice(1).split('/')
}
