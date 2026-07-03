import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

const PACKAGE_PATTERN = '[^/]+/[^/]+'

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

// Connect OAuth
export const connectAuthorize = route('/connect/authorize')

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

// Data products (workspace-global, un-bucketed virtual-bucket browse)
export const dataProduct = route(
  '/data-products/:id',
  (id: string) => `/data-products/${id}`,
)

export const dataProductObjects = route(
  '/data-products/:id/objects/:path(.*)?',
  (id: string, path = '') => `/data-products/${id}/objects/${path}`,
)

export const dataProductPackages = route(
  '/data-products/:id/packages',
  (id: string) => `/data-products/${id}/packages`,
)

// DP-local package drill-in: carries the virtual package name (encoded into a
// single segment so an author-chosen name containing slashes stays one param)
// plus the inner manifest path after `/tree/`, so a package's contents are
// browsed entirely within the DP — never a jump to `/b/<bucket>/…`.
export const dataProductPackage = route(
  '/data-products/:id/packages/:pkg/tree/:path(.*)?',
  (id: string, pkg: string, path = '') =>
    `/data-products/${id}/packages/${encodeURIComponent(pkg)}/tree/${encode(path)}`,
)

// Queries (workspace-global query consoles; the bucket is a parameter of the
// console, never part of the mount point)
export const queries = route('/queries')

export type QueriesArgs = Parameters<typeof queries.url>

export const queriesAthena = route(
  '/queries/athena',
  // `table` (together with the `bucket` hosting it) deep-links a Tabulator
  // table to autofill the query editor.
  ({ bucket, table }: { bucket?: string; table?: string } = {}) =>
    `/queries/athena${mkSearch({ bucket, table })}`,
)

export type QueriesAthenaArgs = Parameters<typeof queriesAthena.url>

export const queriesAthenaWorkgroup = route(
  '/queries/athena/:workgroup',
  (workgroup: string) => `/queries/athena/${workgroup}`,
)

export type QueriesAthenaWorkgroupArgs = Parameters<typeof queriesAthenaWorkgroup.url>

export const queriesAthenaExecution = route(
  '/queries/athena/:workgroup/:queryExecutionId',
  (workgroup: string, queryExecutionId: string) =>
    `/queries/athena/${workgroup}/${queryExecutionId}`,
)

export type QueriesAthenaExecutionArgs = Parameters<typeof queriesAthenaExecution.url>

export const queriesEs = route('/queries/es')

export type QueriesEsArgs = Parameters<typeof queriesEs.url>

// Immutable URI resolver
export const uriResolver = route(
  '/uri/:uri(.*)',
  (uri: string) => `/uri/${uri ? encodeURIComponent(uri) : ''}`,
)

export const redir = route(
  '/redir/:uri(.*)',
  (uri: string) => `/redir/${uri ? encodeURIComponent(uri) : ''}`,
)

export type RedirArgs = Parameters<typeof redir.url>

// Bucket
export const bucketRoot = route('/b/:bucket', (bucket: string) => `/b/${bucket}`)
export const bucketOverview = bucketRoot

export type BucketOverviewArgs = Parameters<typeof bucketOverview.url>

// redirects to global search
export const bucketSearch = route(
  '/b/:bucket/search',
  (bucket: string, { q, p, mode, retry }: SearchOpts = {}) =>
    `/b/${bucket}/search${mkSearch({ q, p, mode, retry })}`,
)

interface BucketFileOpts {
  add?: string // PackageURI for adding this file to
  next?: string
  edit?: boolean
  mode?: string
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
  // KeywordWildcard value for the search model's `name` filter (e.g. `foo/` →
  // matches the `foo/*` prefix). Must stay in sync with PackagesSearchFilterIO.
  name?: string
}

export const bucketPackageList = route(
  '/b/:bucket/packages/',
  (bucket: string, { name }: BucketPackageListOpts = {}) =>
    `/b/${bucket}/packages/${mkSearch({ name })}`,
)
export type BucketPackageListArgs = Parameters<typeof bucketPackageList.url>

export const bucketPackageDetail = route(
  `/b/:bucket/packages/:name(${PACKAGE_PATTERN})`,
  (bucket: string, name: string) => `/b/${bucket}/packages/${name}`,
)

export type BucketPackageDetailArgs = Parameters<typeof bucketPackageDetail.url>

interface BucketPackageAddFilesOpts {
  [logicalKey: string]: string // S3 url
}

export const bucketPackageAddFiles = route(
  `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/add`,
  (bucket: string, name: string, files: BucketPackageAddFilesOpts = {}) =>
    `/b/${bucket}/packages/${name}/add${mkSearch(files)}`,
)

export type BucketPackageAddFilesArgs = Parameters<typeof bucketPackageAddFiles.url>

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

export type BucketPackageRevisionsArgs = Parameters<typeof bucketPackageRevisions.url>

interface BucketPackageCompareOpts {
  showAll?: boolean
}

export const bucketPackageCompare = route(
  `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/compare/:baseHash/:otherHash?/`,
  (
    bucket: string,
    name: string,
    base: string,
    other?: string,
    { showAll }: BucketPackageCompareOpts = {},
  ) =>
    other
      ? `/b/${bucket}/packages/${name}/compare/${base}/${other}/${mkSearch({ showAll })}`
      : `/b/${bucket}/packages/${name}/compare/${base}/${mkSearch({ showAll })}`,
)

export type BucketPackageCompareArgs = Parameters<typeof bucketPackageCompare.url>

// Legacy bucket-scoped query console routes — the console now lives at the
// workspace-global `queries*` routes above; these paths are kept only so old
// links redirect there (see App.jsx). Don't link to them.
export const bucketQueries = route(
  '/b/:bucket/queries',
  (bucket: string) => `/b/${bucket}/queries`,
)

export type BucketQueriesArgs = Parameters<typeof bucketQueries.url>

export const bucketESQueries = route(
  '/b/:bucket/queries/es',
  (bucket: string) => `/b/${bucket}/queries/es`,
)

export type BucketESQueriesArgs = Parameters<typeof bucketESQueries.url>

export const bucketAthena = route(
  '/b/:bucket/queries/athena',
  (bucket: string, { table }: { table?: string } = {}) =>
    `/b/${bucket}/queries/athena${mkSearch({ table })}`,
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

export const bucketWorkflowList = route(
  '/b/:bucket/workflows/',
  (bucket: string) => `/b/${bucket}/workflows/`,
)

export type BucketWorkflowListArgs = Parameters<typeof bucketWorkflowList.url>

export const bucketWorkflowDetail = route(
  '/b/:bucket/workflows/:slug',
  (bucket: string, workflow: string) => `/b/${bucket}/workflows/${workflow}`,
)

export type BucketWorkflowDetailArgs = Parameters<typeof bucketWorkflowDetail.url>

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
export const adminStatus = route('/admin/status')
