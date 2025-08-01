import * as PackageUri from 'utils/PackageUri'

export default function parsePackageUriSafe(decoded: string) {
  try {
    return PackageUri.parse(decoded)
  } catch (e) {
    if (e instanceof PackageUri.PackageUriError) return e
    return new PackageUri.PackageUriError('unknown error: ${e}', decoded)
  }
}
