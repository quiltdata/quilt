import { parse as parseQs } from 'querystring'
import { parse as parseUrl } from 'url'

import * as R from 'ramda'

import { BaseError } from 'utils/error'

export class PackageUriError extends BaseError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'PackageUriError'

  constructor(msg, uri) {
    super(`Invalid package URI (${uri}): ${msg}`, { msg, uri })
  }
}

function parsePackageSpec(spec, uri) {
  if (spec.includes(':')) {
    const [name, tag, ...rest] = spec.split(':')
    if (!name) {
      throw new PackageUriError(
        '"package=" part must contain non-empty package name.',
        uri,
      )
    }
    if (!tag) {
      throw new PackageUriError('"package=" part: tag must not be empty.', uri)
    }
    if (rest.length) {
      throw new PackageUriError('"package=" part may contain only one ":".', uri)
    }
    return { name, tag }
  }
  if (spec.includes('@')) {
    const [name, hash, ...rest] = spec.split('@')
    if (!name) {
      throw new PackageUriError(
        '"package=" part must contain non-empty package name.',
        uri,
      )
    }
    if (!hash) {
      throw new PackageUriError('"package=" part: hash must not be empty.', uri)
    }
    if (rest.length) {
      throw new PackageUriError('"package=" part may contain only one "@".', uri)
    }
    return { name, hash }
  }
  return { name: spec }
}

// TODO: do we need strict parsing here (throw on extra parameters)?
// TODO: do we need extra validation for each part (package name, path, registry, etc)?
export function parse(uri) {
  const url = parseUrl(uri)
  if (url.protocol !== 'quilt+s3:') {
    throw new PackageUriError(
      `unsupported protocol "${url.protocol}". "quilt+s3:" is currently the only supported protocol.`,
      uri,
    )
  }
  if (!url.slashes) {
    throw new PackageUriError('missing slashes between protocol and registry.', uri)
  }
  if (url.path) {
    throw new PackageUriError(
      'non-bucket-root registries are not supported currently.',
      uri,
    )
  }
  const bucket = url.host
  const params = parseQs(url.hash.replace('#', ''))
  if (!params.package) {
    throw new PackageUriError('missing "package=" part.', uri)
  }
  const { name, hash, tag } = parsePackageSpec(params.package, uri)
  return R.reject(R.isNil, { bucket, name, hash, tag, path: params.path || null })
}

export function stringify(parsed) {
  const pathPart = parsed.path ? `&path=${parsed.path}` : ''
  let pkgSpec = parsed.name
  if (parsed.hash) {
    pkgSpec += `@${parsed.hash}`
  } else if (parsed.tag) {
    pkgSpec += `:${parsed.tag}`
  }
  return `quilt+s3://${parsed.bucket}#package=${pkgSpec}${pathPart}`
}
