import { parse as parseQs } from 'querystring'
import { parse as parseUrl } from 'url'

import * as R from 'ramda'

import { BaseError } from 'utils/error'

export class PackageUriError extends BaseError {
  static displayName = 'PackageUriError'

  constructor(msg: string, uri: string) {
    super(`Invalid package URI (${uri}): ${msg}`, { msg, uri })
  }
}

export interface PackageUri {
  bucket: string
  name: string
  path?: string
  hash?: string
  tag?: string
  query?: URLSearchParams
}

function parsePackageSpec(spec: string, uri: string) {
  if (spec.includes(':') && spec.includes('@')) {
    throw new PackageUriError('"package=" part may either contain ":" or "@".', uri)
  }
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
export function parse(uri: string): PackageUri {
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
  // NOTE: `search` is not a part of `path`, if parsed with `new URL`
  // TODO: migrate to `new URL`
  if (url.path && url.path !== url.search && url.path !== `/${url.search}`) {
    throw new PackageUriError(
      'non-bucket-root registries are not supported currently.',
      uri,
    )
  }
  const bucket = url.host
  // TODO: migrate to `new URLSearchParams`
  const params = parseQs((url.hash || '').replace('#', ''))
  if (!params.package) {
    throw new PackageUriError('missing "package=" part.', uri)
  }
  if (Array.isArray(params.package)) {
    throw new PackageUriError('"package=" specified multiple times.', uri)
  }
  const { name, hash, tag } = parsePackageSpec(params.package, uri)
  if (Array.isArray(params.path)) {
    throw new PackageUriError('"path=" specified multiple times.', uri)
  }
  const path = params.path ? decodeURIComponent(params.path) : undefined
  const query = url.search ? new URLSearchParams(url.search) : undefined
  return R.reject(R.isNil, {
    bucket,
    name,
    hash,
    tag,
    path,
    query,
  }) as unknown as PackageUri
}

// FIXME: revert changes
//        use separate module that parses stringified PackageUri
//        and then edits its fields: schema and query
export function stringify(
  { bucket, name, hash, tag, path }: PackageUri,
  optSchema?: string, // TODO: optonal URI params to merge with
) {
  if (!bucket) throw new Error('PackageUri.stringify: missing "bucket"')
  if (!name) throw new Error('PackageUri.stringify: missing "name"')
  if (hash && tag) {
    throw new Error(`PackageUri.stringify: can't have both "hash" and "tag"`)
  }
  let pkgSpec = name
  if (hash) {
    pkgSpec += `@${hash}`
  } else if (tag) {
    pkgSpec += `:${tag}`
  }
  const pathPart = path ? `&path=${encodeURIComponent(path)}` : ''
  const schema = optSchema || 'quilt+s3'
  return `${schema}://${bucket}#package=${pkgSpec}${pathPart}`
}
