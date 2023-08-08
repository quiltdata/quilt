import * as Model from 'model'
import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

const PACKAGE_PATTERN = '[^/]+/[^/]+'

// TODO: make sure types are explicitly divide codebase into
//       main catalog and embed,
//       so catalog routes aren't called in embed

export type NoArgs = []

type Route<Args extends any[] = NoArgs> = {
  path: string
  url: (...args: Args) => string
}

export type HomeArgs = [options?: { q?: string }]

export const home: Route<HomeArgs> = {
  path: '/',
  url: ({ q } = {}) => `/${mkSearch({ q })}`,
}

export const install: Route = {
  path: '/install',
  url: () => '/install',
}

// Marketing

export const about: Route = {
  path: '/about',
  url: () => '/about',
}

export const personas: Route = {
  path: '/personas',
  url: () => '/personas',
}

export const product: Route = {
  path: '/product',
  url: () => '/product',
}

export type ActivateArgs = [options: { registryUrl: string; token: string }]

export const activate: Route<ActivateArgs> = {
  path: '/activate/:token',
  url: ({ registryUrl, token }) => `${registryUrl}/activate/${token}`,
}

export const example: Route = {
  path: '/__example',
  url: () => '/__example',
}

export type SignInArgs = [next: string]

// Auth

export const signIn: Route<SignInArgs> = {
  path: '/signin',
  url: (next) => `/signin${mkSearch({ next })}`,
}

export const signOut: Route = {
  path: '/signout',
  url: () => '/signout',
}

export type SignOutArgs = [next: string]

export const signUp: Route<SignOutArgs> = {
  path: '/signup',
  url: (next) => `/signup${mkSearch({ next })}`,
}

export const passReset: Route = {
  path: '/reset_password',
  url: () => '/reset_password',
}

export type PassChangeArgs = [link: string]

export const passChange: Route<PassChangeArgs> = {
  path: '/reset_password/:link',
  url: (link) => `/reset_password/${link}`,
}

export const code: Route = {
  path: '/code',
  url: () => '/code',
}

export const activationError: Route = {
  path: '/activation_error',
  url: () => '/activation_error',
}

// Profile

export const profile: Route = {
  path: '/profile',
  url: () => '/profile',
}

export type SearchArgs = [
  options: { q: string; buckets: string; p: string; mode: string; retry: string },
]

// Global search

export const search: Route<SearchArgs> = {
  path: '/search',
  url: ({ q, buckets, p, mode, retry }) =>
    `/search${mkSearch({ q, buckets, p, mode, retry })}`,
}

export type UriResolverArgs = [uri: string]

// Immutable URI resolver

export const uriResolver: Route<UriResolverArgs> = {
  path: '/uri/:uri(.*)',
  url: (uri) => `/uri/${uri ? encodeURIComponent(uri) : ''}`,
}

// Bucket

export type BucketRootArgs = [bucket: string]

export const bucketRoot: Route<BucketRootArgs> = {
  path: '/b/:bucket',
  url: (bucket) => `/b/${bucket}`,
}

export type BucketSearchArgs = [
  bucket: string,
  options?: { q?: string; p?: string; mode?: string; retry?: string },
]

export const bucketOverview = bucketRoot
// redirects to global search
export const bucketSearch: Route<BucketSearchArgs> = {
  path: '/b/:bucket/search',
  url: (bucket, { q, p, mode, retry } = {}) =>
    `/b/${bucket}/search${mkSearch({ q, p, mode, retry })}`,
}

export type BucketFileArgs = [
  location: Model.S3.S3ObjectLocation,
  options?: {
    add?: string
    edit?: boolean
    mode?: string
    next?: string
  },
]

export const bucketFile: Route<BucketFileArgs> = {
  path: '/b/:bucket/tree/:path(.*[^/])',
  url: ({ bucket, key, version }, { add, edit, mode, next } = {}) =>
    `/b/${bucket}/tree/${encode(key)}${mkSearch({ add, edit, mode, next, version })}`,
}

export type BucketDirArgs = [location: Model.S3.S3ObjectLocation, prefix?: string]

export const bucketDir: Route<BucketDirArgs> = {
  path: '/b/:bucket/tree/:path(.+/)?',
  // eslint-disable-next-line @typescript-eslint/default-param-last
  url: ({ bucket, key }: Model.S3.S3ObjectLocation, prefix) =>
    `/b/${bucket}/tree/${encode(key)}${mkSearch({ prefix: prefix || undefined })}`,
}

export type BucketPackageListArgs = [
  bucket: string,
  options?: { filter?: string; sort?: string; p?: string },
]

export const bucketPackageList: Route<BucketPackageListArgs> = {
  path: '/b/:bucket/packages/',
  url: (bucket, { filter, sort, p } = {}) =>
    `/b/${bucket}/packages/${mkSearch({ filter, sort, p })}`,
}

export type BucketPackageDetailArgs = [
  handle: Model.Package.Handle,
  options?: { action?: string },
]

export const bucketPackageDetail: Route<BucketPackageDetailArgs> = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})`,
  url: ({ bucket, name }, { action } = {}) =>
    `/b/${bucket}/packages/${name}${mkSearch({ action })}`,
}

export type BucketPackageTreeArgs = [
  handle: Model.Package.Handle,
  revision: Model.Package.Revision,
  path?: string,
  mode?: string,
]

export const bucketPackageTree: Route<BucketPackageTreeArgs> = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/tree/:revision/:path(.*)?`,
  // eslint-disable-next-line @typescript-eslint/default-param-last
  url: ({ bucket, name }, revision, path = '', mode) =>
    path || revision.alias !== 'latest'
      ? `/b/${bucket}/packages/${name}/tree/${
          Model.Package.hashOrTag(revision) || 'latest'
        }/${encode(path)}${mkSearch({ mode })}`
      : bucketPackageDetail.url({ bucket, name }),
}

export type BucketPackageRevisionsArgs = [
  bucket: string,
  name: string,
  options?: { p?: string },
]

export const bucketPackageRevisions: Route<BucketPackageRevisionsArgs> = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/revisions`,
  url: (bucket, name, { p } = {}) =>
    `/b/${bucket}/packages/${name}/revisions${mkSearch({ p })}`,
}

export type BucketQueriesArgs = [bucket: string]

export const bucketQueries: Route<BucketQueriesArgs> = {
  path: '/b/:bucket/queries',
  url: (bucket) => `/b/${bucket}/queries`,
}

export const bucketESQueries: Route<BucketQueriesArgs> = {
  path: '/b/:bucket/queries/es',
  url: (bucket) => `/b/${bucket}/queries/es`,
}

export const bucketAthena: Route<BucketQueriesArgs> = {
  path: '/b/:bucket/queries/athena',
  url: (bucket) => `/b/${bucket}/queries/athena`,
}

export type BucketAthenaWorkgroupArgs = [bucket: string, workgroup: string]

export const bucketAthenaWorkgroup: Route<BucketAthenaWorkgroupArgs> = {
  path: '/b/:bucket/queries/athena/:workgroup',
  url: (bucket, workgroup) => `/b/${bucket}/queries/athena/${workgroup}`,
}

export type BucketAthenaExecutionArgs = [
  bucket: string,
  workgroup: string,
  queryExecutionId: string,
]

export const bucketAthenaExecution: Route<BucketAthenaExecutionArgs> = {
  path: '/b/:bucket/queries/athena/:workgroup/:queryExecutionId',
  url: (bucket, workgroup, queryExecutionId) =>
    `/b/${bucket}/queries/athena/${workgroup}/${queryExecutionId}`,
}

// Legacy stuff

export type LegacyPackagesArgs = [root: string, loc: Location]

export const legacyPackages: Route<LegacyPackagesArgs> = {
  path: `/package/:path+`,
  url: (root, loc) => `${root}${loc.pathname}${loc.search}${loc.hash}`,
}

// Admin

export const admin: Route = {
  path: '/admin',
  url: () => '/admin',
}

export const adminUsers = admin

export type AdminBucketsArgs = [bucket: string]

export const adminBuckets: Route<AdminBucketsArgs> = {
  path: '/admin/buckets',
  url: (bucket) => `/admin/buckets${mkSearch({ bucket })}`,
}

export const adminSettings: Route = {
  path: '/admin/settings',
  url: () => '/admin/settings',
}

export const adminSync: Route = {
  path: '/admin/sync',
  url: () => '/admin/sync',
}

export const adminStatus: Route = {
  path: '/admin/status',
  url: () => '/admin/status',
}
