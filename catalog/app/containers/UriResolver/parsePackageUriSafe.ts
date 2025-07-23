import * as PackageUri from 'utils/PackageUri'
import { isError } from 'utils/error'

export default function parsePackageUriSafe(decoded: string) {
  try {
    return PackageUri.parse(decoded)
  } catch (e) {
    if (isError<unknown, PackageUri.PackageUriError>(e)) return e
    return new PackageUri.PackageUriError('unknown error: ${e}', decoded)
  }
}
