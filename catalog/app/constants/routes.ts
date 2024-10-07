import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

const PACKAGE_PATTERN = '[^/]+/[^/]+'

// TODO: make sure types explicitly divide codebase into
//       main catalog and embed,
//       so catalog routes aren't called in embed

export type Route<Path extends string, Args extends any[]> = {
  path: Path
  url: (...args: Args) => string
}

const route = <Path extends string, Args extends any[] = []>(
  path: Path,
  url?: (...args: Args) => string,
): Route<Path, Args> => ({ path, url: url ?? (() => path) })

// The actual routes start

export const home = route(
  '/',
  (params?: { q?: string }) => `/${mkSearch({ q: params?.q })}`,
)

export const install = route('/install', () => '/install')

// Auth
export const activate = route(
  '/activate/:token',
  (params: { registryUrl: string; token: string }) =>
    `${params.registryUrl}/activate/${params.token}`,
)

export const signIn = route('/signin', (next?: string) => `/signin${mkSearch({ next })}`)

export const signOut = route('/signout')

export const signUp = route('/signup', (next?: string) => `/signup${mkSearch({ next })}`)

export const passReset = route('/reset_password')

export const passChange = route(
  '/reset_password/:link',
  (link: string) => `/reset_password/${link}`,
)

export const code = route('/code')

export const activationError = route('/activation_error')

// Profile
export const profile = route('/profile')

// Global search
interface SearchOpts {
  q?: string
  buckets?: string
  p?: string
  mode?: string
  retry?: string
}

export const search = route(
  '/search',
  // TODO: these params are outdated -- sync with actual search params
  ({ q, buckets, p, mode, retry }: SearchOpts) =>
    `/search${mkSearch({ q, buckets, p, mode, retry })}`,
)

// Immutable URI resolver
export const uriResolver = route(
  '/uri/:uri(.*)',
  (uri: string) => `/uri/${uri ? encodeURIComponent(uri) : ''}`,
)

// Bucket
export const bucketRoot = route('/b/:bucket', (bucket: string) => `/b/${bucket}`)
export const bucketOverview = bucketRoot

// redirects to global search
export const bucketSearch = route(
  '/b/:bucket/search',
  (bucket: string, { q, p, mode, retry }: SearchOpts = {}) =>
    `/b/${bucket}/search${mkSearch({ q, p, mode, retry })}`,
)

interface BucketFileOpts {
  add?: string
  edit?: boolean
  mode?: string
  next?: string
  version?: string
}

export const bucketFile = route(
  '/b/:bucket/tree/:path(.*[^/])',
  (
    bucket: string,
    path: string,
    { add, edit, mode, next, version }: BucketFileOpts = {},
  ) => `/b/${bucket}/tree/${encode(path)}${mkSearch({ add, edit, mode, next, version })}`,
)
export type BucketFileArgs = Parameters<typeof bucketFile.url>

export const bucketDir = route(
  '/b/:bucket/tree/:path(.+/)?',
  (bucket: string, path: string = '', prefix?: string) =>
    `/b/${bucket}/tree/${encode(path)}${mkSearch({ prefix: prefix || undefined })}`,
)
export type BucketDirArgs = Parameters<typeof bucketDir.url>

interface BucketPackageListOpts {
  filter?: string
  sort?: string
  p?: string
}

export const bucketPackageList = route(
  '/b/:bucket/packages/',
  (bucket: string, { filter, sort, p }: BucketPackageListOpts = {}) =>
    `/b/${bucket}/packages/${mkSearch({ filter, sort, p })}`,
)
export type BucketPackageListArgs = Parameters<typeof bucketPackageList.url>

interface BucketPackageDetailOpts {
  action?: string
}

export const bucketPackageDetail = route(
  `/b/:bucket/packages/:name(${PACKAGE_PATTERN})`,
  (bucket: string, name: string, { action }: BucketPackageDetailOpts = {}) =>
    `/b/${bucket}/packages/${name}${mkSearch({ action })}`,
)
export type BucketPackageDetailArgs = Parameters<typeof bucketPackageDetail.url>

export const bucketPackageTree = route(
  `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/tree/:revision/:path(.*)?`,
  (bucket: string, name: string, revision?: string, path: string = '', mode?: string) =>
    path || (revision && revision !== 'latest')
      ? `/b/${bucket}/packages/${name}/tree/${revision || 'latest'}/${encode(
          path,
        )}${mkSearch({ mode })}`
      : bucketPackageDetail.url(bucket, name),
)
export type BucketPackageTreeArgs = Parameters<typeof bucketPackageTree.url>

interface BucketPackageRevisionsOpts {
  p?: string
}

export const bucketPackageRevisions = route(
  `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/revisions`,
  (bucket: string, name: string, { p }: BucketPackageRevisionsOpts = {}) =>
    `/b/${bucket}/packages/${name}/revisions${mkSearch({ p })}`,
)

export const bucketQueries = route(
  '/b/:bucket/queries',
  (bucket: string) => `/b/${bucket}/queries`,
)

export const bucketESQueries = route(
  '/b/:bucket/queries/es',
  (bucket: string) => `/b/${bucket}/queries/es`,
)

export const bucketAthena = route(
  '/b/:bucket/queries/athena',
  (bucket: string) => `/b/${bucket}/queries/athena`,
)

export const bucketAthenaWorkgroup = route(
  '/b/:bucket/queries/athena/:workgroup',
  (bucket: string, workgroup: string) => `/b/${bucket}/queries/athena/${workgroup}`,
)

export const bucketAthenaExecution = route(
  '/b/:bucket/queries/athena/:workgroup/:queryExecutionId',
  (bucket: string, workgroup: string, queryExecutionId: string) =>
    `/b/${bucket}/queries/athena/${workgroup}/${queryExecutionId}`,
)

// Legacy stuff
export const legacyPackages = route(
  `/package/:path+`,
  (root: string, loc: Location) => `${root}${loc.pathname}${loc.search}${loc.hash}`,
)

// Admin
export const admin = route('/admin')
export const adminUsers = admin

export const adminBuckets = route(
  '/admin/buckets',
  (opts?: { add?: boolean }) => `/admin/buckets${mkSearch({ add: opts?.add })}`,
)

export const adminBucketEdit = route(
  '/admin/buckets/:bucketName',
  (bucketName: string) => `/admin/buckets/${bucketName}`,
)

export const adminSettings = route('/admin/settings')
export const adminSync = route('/admin/sync')
export const adminStatus = route('/admin/status')
