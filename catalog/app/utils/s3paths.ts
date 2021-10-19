import { dirname, basename, resolve } from 'path'
import { parse as parseUrl } from 'url'

import * as R from 'ramda'

import { mkSearch } from 'utils/NamedRoutes'

/**
 * Handle for an S3 object.
 *
 * @typedef {Object} S3Handle
 *
 * @property {string} region
 * @property {string} bucket
 * @property {string} key
 * @property {string} version
 * @property {Date} modified
 * @property {number} size
 * @property {string} etag
 */

interface S3HandleBase {
  bucket: string
  key: string
  version?: string
}

interface S3Handle extends S3HandleBase {
  region: string
  modified: Date
  size: Number
  etag: string
}

/**
 * Ensure the string has no trailing slash.
 *
 * @param {string} str
 *
 * @returns {string}
 */
export const ensureNoSlash = (str: string) => str.replace(/\/$/, '')

/**
 * Ensure the string has a trailing slash.
 *
 * @param {string} str
 *
 * @returns {string}
 */
export const ensureSlash = (str: string) => `${ensureNoSlash(str)}/`

/**
 * Go up a level.
 *
 * @param {string} prefix
 *
 * @returns {string}
 */
export const up = (prefix: string) => {
  // handle double slashes
  if (prefix.endsWith('//')) return prefix.substring(0, prefix.length - 1)
  const m = prefix.match(/^(.*\/\/)[^/]+$/)
  if (m) return m[1]
  const d = dirname(prefix)
  return d === '.' || d === '/' ? '' : ensureSlash(d)
}

/**
 * Check if the path is a directory / prefix (ends with a slash).
 *
 * @param {string} path
 *
 * @returns {bool}
 */
export const isDir = (path: string) => path === '' || path.endsWith('/')

/**
 * Get the "prefix" part of a path.
 *
 * @param {string} path
 *
 * @returns {string}
 */
export const getPrefix = (path: string) => {
  if (!path) return ''
  if (isDir(path)) return path
  const name = dirname(path)
  return name === '.' ? '' : ensureSlash(name)
}

/**
 * Get the "basename" part of a path.
 *
 * @param {string} path
 *
 * @returns {string}
 */
export const getBasename = (path: string) => {
  if (!path) return ''
  return isDir(path) ? '' : basename(path)
}

/**
 * Split a path into a basename and prefix parts. Examples:
 *
 * path       | prefix     | basename
 * -----------+------------+---------
 * ''         | ''         | ''
 * 'hey'      | ''         | 'hey'
 * 'hey/'     | 'hey/'     | ''
 * 'hey/sup'  | 'hey/'     | 'sup'
 * 'hey/sup/' | 'hey/sup/' | ''
 *
 * @param {string} path
 *
 * @returns {{ prefix: string, basename: string }}
 */
export const splitPath = (path: string) => ({
  prefix: getPrefix(path),
  basename: getBasename(path),
})

/**
 * Remove specified prefix from the path.
 *
 * @param {string} prefix
 * @param {string} path
 *
 * @returns {string}
 */
export const withoutPrefix = (prefix: string, path: string) =>
  path.startsWith(prefix) ? path.replace(prefix, '') : path

/**
 * Check if the string is an S3 URL.
 *
 * @param {string} url
 *
 * @returns {bool}
 */
export const isS3Url = (url: string) => url.startsWith('s3://')

/**
 * Parse an S3 URL and create an S3Handle out of it.
 *
 * @param {string} url
 *
 * @returns {S3Handle}
 */
export const parseS3Url = (url: string) => {
  const u = parseUrl(url, true)
  return {
    bucket: u.hostname,
    key: decode((u.pathname || '/').substring(1)),
    version: u.query.versionId,
  }
}

/**
 * Resolve an S3 key.
 *
 * @param {string} from
 * @param {string} to
 *
 * @returns {string}
 */
export const resolveKey = (from: string, to: string) =>
  resolve(`/${getPrefix(from)}`, to).substring(1)

/**
 * Create an S3Handle for a URL relative to the given S3Handle.
 *
 * @param {string} url
 * @param {S3Handle} referrer
 *
 * @returns {S3Handle}
 */
export const handleFromUrl = (url: string, referrer: S3Handle) => {
  // absolute URL (e.g. `s3://${bucket}/${key}`)
  if (isS3Url(url)) return parseS3Url(url)
  if (!referrer) {
    throw new Error('handleFromUrl: referrer required for local URLs')
  }
  // path-like URL (e.g. `dir/file.json` or `/dir/file.json`)
  return { bucket: referrer.bucket, key: resolveKey(referrer.key, url) }
}

// AWS docs (https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingBucket.html) state that
// "buckets created in Regions launched after March 20, 2019 are not reachable via the
// `https://bucket.s3.amazonaws.com naming scheme`", so probably we need to support
// `https://bucket.s3.aws-region.amazonaws.com` scheme as well.
export const handleToHttpsUri = ({ bucket, key, version }: S3HandleBase) =>
  `https://${bucket}.s3.amazonaws.com/${encode(key)}${mkSearch({ versionId: version })}`

export const handleToS3Url = ({ bucket, key, version = undefined }: S3HandleBase) =>
  `s3://${bucket}/${encode(key)}${mkSearch({ versionId: version })}`

/**
 * Get breadcrumbs for a path.
 *
 * @param {string} path
 *
 * @returns {[{ label: string, path: string }]}
 */
export const getBreadCrumbs = (path: string): { label: string; path: string }[] =>
  path
    ? [
        ...getBreadCrumbs(up(path)),
        { label: path.endsWith('//') ? '' : basename(path), path },
      ]
    : []

export const encode = R.pipe(R.split('/'), R.map(encodeURIComponent), R.join('/'))

export const decode = R.pipe(R.split('/'), R.map(decodeURIComponent), R.join('/'))
