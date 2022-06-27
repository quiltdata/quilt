import * as PackageUri from './PackageUri'

// TODO: add query
// export functin parse() {}

export function stringify(packageHandle: PackageUri.PackageUri): string {
  return PackageUri.stringify(packageHandle).replace('quilt+s3', 'teleport')
}
