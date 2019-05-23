import tagged from 'utils/tagged'

/*
s3 urls:
bucket/key/with/path/segments
/key/with/path/segments
./relative/path
../relative/path
*/

export const ContextType = tagged(['MDImg', 'MDLink', 'Summary', 'Vega'])

/**
 * @typedef {Object} Context
 *
 * @property {ContextType} type
 * @property {S3Handle} handle
 */

export const Pointer = tagged([
  'Web', // {string} url
  'S3', // {S3Handle} handle
  'S3Rel', // {string} path
  'Path', // {string} path
])

/**
 * @typedef {Object} ResourceHandle
 *
 * @property {ResourceContext} ctx
 * @property {ResourcePointer} ptr
 */

const WEB_RE = /^(https?:)?\/\//
const S3_RE = /^s3:\/\//

export const parse = (url) => {
  if (WEB_RE.test(url)) {
    return Pointer.Web(url)
  }
  if (S3_RE.test(url)) {
    const pth = url.replace(S3_RE, '')
    const m = pth.match(/^([a-z0-9-]+)?\/([^.].+)$/)
    if (m) {
      return Pointer.S3({ bucket: m[1], key: m[2] })
    }
    if (pth.startsWith('.')) {
      return Pointer.S3Rel(pth)
    }
    // TODO
    throw new TypeError(`Invalid S3 URL: ${url}`)
  }
  // TODO: check path format as well
  return Pointer.Path(url)
}
