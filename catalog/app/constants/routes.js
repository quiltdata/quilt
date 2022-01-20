import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

const PACKAGE_PATTERN = '[^/]+/[^/]+'

export const home = {
  path: '/',
  url: ({ q } = {}) => `/${mkSearch({ q })}`,
}

export const install = {
  path: '/install',
  url: () => '/install',
}

// marketing
export const about = {
  path: '/about',
  url: () => '/about',
}

export const personas = {
  path: '/personas',
  url: () => '/personas',
}

export const product = {
  path: '/product',
  url: () => '/product',
}

export const activate = {
  path: '/activate/:token',
  url: ({ registryUrl, token }) => `${registryUrl}/activate/${token}`,
}

export const example = {
  path: '/__example',
  url: () => '/__example',
}

// auth
export const signIn = {
  path: '/signin',
  url: (next) => `/signin${mkSearch({ next })}`,
}
export const signOut = {
  path: '/signout',
  url: () => '/signout',
}
export const signUp = {
  path: '/signup',
  url: (next) => `/signup${mkSearch({ next })}`,
}
export const passReset = {
  path: '/reset_password',
  url: () => '/reset_password',
}
export const passChange = {
  path: '/reset_password/:link',
  url: (link) => `/reset_password/${link}`,
}
export const ssoSignUp = {
  path: '/signup-sso',
  url: ({ provider, token, next }) => `/signup-sso${mkSearch({ provider, token, next })}`,
}
export const code = {
  path: '/code',
  url: () => '/code',
}
export const activationError = {
  path: '/activation_error',
  url: () => '/activation_error',
}

// profile
export const profile = {
  path: '/profile',
  url: () => '/profile',
}

// global search
export const search = {
  path: '/search',
  url: ({ q, buckets, p, mode, retry }) =>
    `/search${mkSearch({ q, buckets, p, mode, retry })}`,
}

// immutable URI resolver
export const uriResolver = {
  path: '/uri/:uri(.*)',
  url: (uri) => `/uri/${uri ? encodeURIComponent(uri) : ''}`,
}

// bucket
export const bucketRoot = {
  path: '/b/:bucket',
  url: (bucket) => `/b/${bucket}`,
}
export const bucketOverview = bucketRoot
export const bucketSearch = {
  path: '/b/:bucket/search',
  url: (bucket, { q, p, mode, retry } = {}) =>
    `/b/${bucket}/search${mkSearch({ q, p, mode, retry })}`,
}
export const bucketFile = {
  path: '/b/:bucket/tree/:path(.*[^/])',
  url: (bucket, path, version, mode) =>
    `/b/${bucket}/tree/${encode(path)}${mkSearch({ mode, version })}`,
}
export const bucketDir = {
  path: '/b/:bucket/tree/:path(.+/)?',
  url: (bucket, path = '', prefix) =>
    `/b/${bucket}/tree/${encode(path)}${mkSearch({ prefix: prefix || undefined })}`,
}
export const bucketPackageList = {
  path: '/b/:bucket/packages/',
  url: (bucket, { filter, sort, p } = {}) =>
    `/b/${bucket}/packages/${mkSearch({ filter, sort, p })}`,
}
export const bucketPackageDetail = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})`,
  url: (bucket, name) => `/b/${bucket}/packages/${name}`,
}
export const bucketPackageTree = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/tree/:revision/:path(.*)?`,
  url: (bucket, name, revision, path = '', mode) =>
    path || (revision && revision !== 'latest')
      ? `/b/${bucket}/packages/${name}/tree/${revision || 'latest'}/${encode(
          path,
        )}${mkSearch({ mode })}`
      : bucketPackageDetail.url(bucket, name),
}
export const bucketPackageRevisions = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/revisions`,
  url: (bucket, name, { p } = {}) =>
    `/b/${bucket}/packages/${name}/revisions${mkSearch({ p })}`,
}

export const bucketQueries = {
  path: '/b/:bucket/queries',
  url: (bucket) => `/b/${bucket}/queries`,
}

export const bucketESQueries = {
  path: '/b/:bucket/queries/es',
  url: (bucket) => `/b/${bucket}/queries/es`,
}

export const bucketAthenaQueries = {
  path: '/b/:bucket/queries/athena',
  url: (bucket) => `/b/${bucket}/queries/athena`,
}

export const bucketAthenaQueryExecution = {
  path: '/b/:bucket/queries/athena/:queryExecutionId',
  url: (bucket, queryExecutionId) => `/b/${bucket}/queries/athena/${queryExecutionId}`,
}

// legacy stuff
export const legacyPackages = {
  path: `/package/:path+`,
  url: (root, loc) => `${root}${loc.pathname}${loc.search}${loc.hash}`,
}

// admin
export const admin = {
  path: '/admin',
  url: () => '/admin',
}
export const adminUsers = admin
export const adminBuckets = {
  path: '/admin/buckets',
  url: (bucket) => `/admin/buckets${mkSearch({ bucket })}`,
}
export const adminSettings = {
  path: '/admin/settings',
  url: () => '/admin/settings',
}

// storybook
export const storyBook = {
  path: '/storybook',
  url: () => '/storybook',
}
