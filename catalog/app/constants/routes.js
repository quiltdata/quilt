import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

const PACKAGE_PATTERN = '[a-z0-9-_]+/[a-z0-9-_]+'

export const home = {
  path: '/',
  url: () => '/',
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
  url: ({ q, buckets, p }) => `/search${mkSearch({ q, buckets, p })}`,
}

// bucket
export const bucketRoot = {
  path: '/b/:bucket',
  url: (bucket) => `/b/${bucket}`,
}
export const bucketOverview = bucketRoot
export const bucketSearch = {
  path: '/b/:bucket/search',
  url: (bucket, q, p) => `/b/${bucket}/search${mkSearch({ q, p })}`,
}
export const bucketFile = {
  path: '/b/:bucket/tree/:path+',
  url: (bucket, path, version) =>
    `/b/${bucket}/tree/${encode(path)}${mkSearch({ version })}`,
}
export const bucketDir = {
  path: '/b/:bucket/tree/:path(.+/)?',
  url: (bucket, path = '') => `/b/${bucket}/tree/${encode(path)}`,
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
  url: (bucket, name, revision, path = '') =>
    revision === 'latest' && !path
      ? bucketPackageDetail.url(bucket, name)
      : `/b/${bucket}/packages/${name}/tree/${revision}/${encode(path)}`,
}
export const bucketPackageRevisions = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/revisions`,
  url: (bucket, name, { p } = {}) =>
    `/b/${bucket}/packages/${name}/revisions${mkSearch({ p })}`,
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
