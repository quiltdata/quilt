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

// The volume list. It lives at its own path rather than at `/` because `/` is
// the front door, which is a different page whenever the `front-door` preview
// feature is on; with it off the two render the same thing. Link here -- not to
// `home()` -- for anything that means "the list of buckets".
export const buckets = route('/buckets', () => '/buckets')

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
  // (`buckets` is aliased here only to keep the search param distinct from the
  // `buckets` route above.)
  ({ q, buckets: bucketsParam, p, mode, retry }: SearchOpts) =>
    `/search${mkSearch({ q, buckets: bucketsParam, p, mode, retry })}`,
)

// Queries (workspace-global query consoles; the bucket is a parameter of the
// console, never part of the mount point)
export const queries = route('/queries')

export type QueriesArgs = Parameters<typeof queries.url>

// The Athena console's search, shared by the three routes that render it, so
// they cannot disagree about which params survive a redirect between them.
// `table` (together with the `bucket` hosting it) deep-links a Tabulator table
// to autofill the query editor.
interface AthenaConsoleOpts {
  bucket?: string
  table?: string
}

export const queriesAthena = route(
  '/queries/athena',
  ({ bucket, table }: AthenaConsoleOpts = {}) =>
    `/queries/athena${mkSearch({ bucket, table })}`,
)

export type QueriesAthenaArgs = Parameters<typeof queriesAthena.url>

// These take the same console search as `queriesAthena` above, so a caller does
// not have to hand-build a search string to keep the bucket scope across one.
export const queriesAthenaWorkgroup = route(
  '/queries/athena/:workgroup',
  (workgroup: string, { bucket, table }: AthenaConsoleOpts = {}) =>
    `/queries/athena/${workgroup}${mkSearch({ bucket, table })}`,
)

export type QueriesAthenaWorkgroupArgs = Parameters<typeof queriesAthenaWorkgroup.url>

export const queriesAthenaExecution = route(
  '/queries/athena/:workgroup/:queryExecutionId',
  (
    workgroup: string,
    queryExecutionId: string,
    { bucket }: Omit<AthenaConsoleOpts, 'table'> = {},
  ) =>
    // No `table` here: the editor on an execution route is populated from the
    // execution's own SQL, and TabulatorTables' `?table=` autofill would
    // overwrite it with a SELECT unrelated to the results on screen.
    `/queries/athena/${workgroup}/${queryExecutionId}${mkSearch({ bucket })}`,
)

export type QueriesAthenaExecutionArgs = Parameters<typeof queriesAthenaExecution.url>

export const queriesEs = route('/queries/es')

export type QueriesEsArgs = Parameters<typeof queriesEs.url>

// Data products are defined in an enterprise catalog (DataZone / Unity /
// Snowflake), not in Quilt, so the id is a Quilt-side synthetic composed from
// the platform binding rather than a platform-native identifier.
export const dataProducts = route('/data-products')

export type DataProductsArgs = Parameters<typeof dataProducts.url>

// NOT `encode` from utils/s3paths: that one splits on `/` and encodes each
// segment separately, deliberately preserving slashes as path separators for S3
// keys. Product ids embed the binding and contain slashes of their own
// (`uc:metastore/catalog/schema`), which would spill into extra path segments
// and stop this route matching at all. `encodeURIComponent` keeps the whole id
// in one segment, so `decodeURIComponent` on the way out is its exact inverse.
export const dataProduct = route(
  '/data-products/:dataProductId',
  (dataProductId: string) => `/data-products/${encodeURIComponent(dataProductId)}`,
)

export type DataProductArgs = Parameters<typeof dataProduct.url>

// Sections are their own routes rather than local state, matching the in-bucket
// and Quilt-owned-DP vocabulary: a tab is addressable, survives reload, and can
// be linked to. Same `encodeURIComponent` reasoning as above.
export const dataProductContents = route(
  '/data-products/:dataProductId/contents',
  (dataProductId: string) =>
    `/data-products/${encodeURIComponent(dataProductId)}/contents`,
)

export const dataProductAccess = route(
  '/data-products/:dataProductId/access',
  (dataProductId: string) => `/data-products/${encodeURIComponent(dataProductId)}/access`,
)

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
