import * as PackageUri from './PackageUri'

// TODO: add query
// export functin parse() {}

export function stringify(packageHandle: PackageUri.PackageUri, path?: string): string {
  return PackageUri.stringify(path ? { ...packageHandle, path } : packageHandle)
}
