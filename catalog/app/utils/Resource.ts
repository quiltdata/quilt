import * as tagged from 'utils/taggedV2'

/*
s3 urls:
bucket/key/with/path/segments
/key/with/path/segments
./relative/path
../relative/path
*/

export const Pointer = tagged.create('app/utils/Resource:Pointer' as const, {
  Web: (url: string) => url,
  S3: (h: { bucket: string; key: string }) => h,
  S3Rel: (path: string) => path,
  Path: (path: string) => path,
})

const WEB_RE = /^(https?:)?\/\//
const S3_RE = /^s3:\/\//

export const parse = (url: string) => {
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
