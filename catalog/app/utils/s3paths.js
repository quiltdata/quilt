import { dirname, basename, resolve } from 'path'
import { parse as parseUrl } from 'url'

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

/**
 * Ensure the string has no trailing slash.
 *
 * @param {string} str
 *
 * @returns {string}
 */
export const ensureNoSlash = (str) => str.replace(/\/$/, '')

/**
 * Ensure the string has a trailing slash.
 *
 * @param {string} str
 *
 * @returns {string}
 */
export const ensureSlash = (str) => `${ensureNoSlash(str)}/`

/**
 * Go up a level.
 *
 * @param {string} prefix
 *
 * @returns {string}
 */
export const up = (prefix) => {
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
export const isDir = (path) => path === '' || path.endsWith('/')

/**
 * Get the "prefix" part of a path.
 *
 * @param {string} path
 *
 * @returns {string}
 */
export const getPrefix = (path) => {
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
export const getBasename = (path) => {
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
export const splitPath = (path) => ({
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
export const withoutPrefix = (prefix, path) =>
  path.startsWith(prefix) ? path.replace(prefix, '') : path

/**
 * Check if the string is an S3 URL.
 *
 * @param {string} url
 *
 * @returns {bool}
 */
export const isS3Url = (url) => url.startsWith('s3://')

/**
 * Parse an S3 URL and create an S3Handle out of it.
 *
 * @param {string} url
 *
 * @returns {S3Handle}
 */
export const parseS3Url = (url) => {
  const u = parseUrl(url, true)
  return {
    bucket: u.hostname,
    key: (u.pathname || '/').substring(1),
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
export const resolveKey = (from, to) => resolve(`/${getPrefix(from)}`, to).substring(1)

/**
 * Create an S3Handle for a URL relative to the given S3Handle.
 *
 * @param {string} url
 * @param {S3Handle} referrer
 *
 * @returns {S3Handle}
 */
export const handleFromUrl = (url, referrer) => {
  // absolute URL (e.g. `s3://${bucket}/${key}`)
  if (isS3Url(url)) return parseS3Url(url)
  if (!referrer) {
    throw new Error('handleFromUrl: referrer required for local URLs')
  }
  // path-like URL (e.g. `dir/file.json` or `/dir/file.json`)
  return { bucket: referrer.bucket, key: resolveKey(referrer.key, url) }
}

/**
 * Get breadcrumbs for a path.
 *
 * @param {string} path
 *
 * @returns {[{ label: string, path: string }]}
 */
export const getBreadCrumbs = (path) =>
  path ? [...getBreadCrumbs(up(path)), { label: basename(path), path }] : []
