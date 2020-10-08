import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

export const bucketRoot = {
  path: '/b/:bucket',
  url: (bucket) => `/b/${bucket}`,
}
export const bucketFile = {
  path: '/b/:bucket/tree/:path(.*[^/])',
  url: (bucket, path, version) =>
    `/b/${bucket}/tree/${encode(path)}${mkSearch({ version })}`,
}
export const bucketDir = {
  path: '/b/:bucket/tree/:path(.+/)?',
  url: (bucket, path = '') => `/b/${bucket}/tree/${encode(path)}`,
}
export const bucketSearch = {
  path: '/b/:bucket/search',
  url: (bucket, { q, p, retry }) => `/b/${bucket}/search${mkSearch({ q, p, retry })}`,
}
