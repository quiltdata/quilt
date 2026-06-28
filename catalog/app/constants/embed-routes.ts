import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

export type Route<Path extends string, Args extends any[]> = {
  path: Path
  url: (...args: Args) => string
}

export const bucketRoot: Route<'/b/:bucket', [bucket: string]> = {
  path: '/b/:bucket',
  url: (bucket) => `/b/${bucket}`,
}

interface BucketFileOpts {
  version?: string
}

export const bucketFile: Route<
  '/b/:bucket/tree/:path(.*[^/])',
  [bucket: string, path: string, opts?: BucketFileOpts]
> = {
  path: '/b/:bucket/tree/:path(.*[^/])',
  url: (bucket, path, { version } = {}) =>
    `/b/${bucket}/tree/${encode(path)}${mkSearch({ version })}`,
}

export const bucketDir: Route<
  '/b/:bucket/tree/:path(.+/)?',
  [bucket: string, path?: string, prefix?: string]
> = {
  path: '/b/:bucket/tree/:path(.+/)?',
  // eslint-disable-next-line @typescript-eslint/default-param-last
  url: (bucket, path = '', prefix) =>
    `/b/${bucket}/tree/${encode(path)}${mkSearch({ prefix: prefix || undefined })}`,
}

interface BucketSearchOpts {
  q?: string
  p?: string
  retry?: string
}

export const bucketSearch: Route<
  '/b/:bucket/search',
  [bucket: string, opts: BucketSearchOpts]
> = {
  path: '/b/:bucket/search',
  url: (bucket, { q, p, retry }) => `/b/${bucket}/search${mkSearch({ q, p, retry })}`,
}
