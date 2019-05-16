import { mkSearch } from 'utils/NamedRoutes'

const PACKAGE_PATTERN = '[a-z0-9-_]+/[a-z0-9-_]+'

export const home = {
  path: '/',
  url: () => '/',
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
  url: () => '/signup',
}
export const passReset = {
  path: '/reset_password',
  url: () => '/reset_password',
}
export const passChange = {
  path: '/reset_password/:link',
  url: (link) => `/reset_password/${link}`,
}
export const code = {
  path: '/code',
  url: () => '/code',
}
export const activationError = {
  path: '/activation_error',
  url: () => '/activation_error',
}

// bucket
export const bucketRoot = {
  path: '/b/:bucket',
  url: (bucket) => `/b/${bucket}`,
}
export const bucketSearch = {
  path: '/b/:bucket/search',
  url: (bucket, q) => `/b/${bucket}/search${mkSearch({ q })}`,
}
export const bucketFile = {
  path: '/b/:bucket/tree/:path+',
  url: (bucket, path, version) => `/b/${bucket}/tree/${path}${mkSearch({ version })}`,
}
export const bucketDir = {
  path: [bucketRoot.path, '/b/:bucket/tree/:path(.+/)?'],
  url: (bucket, path = '') =>
    path ? `/b/${bucket}/tree/${path}` : bucketRoot.url(bucket),
}
export const bucketOverview = {
  path: '/b/:bucket/overview',
  url: (bucket) => `/b/${bucket}/overview`,
}
export const bucketPackageList = {
  path: '/b/:bucket/packages/',
  url: (bucket) => `/b/${bucket}/packages/`,
}
export const bucketPackageDetail = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})`,
  url: (bucket, name) => `/b/${bucket}/packages/${name}`,
}
export const bucketPackageTree = {
  path: `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/tree/:revision/:path(.*)?`,
  url: (bucket, name, revision, path = '') =>
    `/b/${bucket}/packages/${name}/tree/${revision}/${path}`,
}

// admin
export const admin = {
  path: '/admin',
  url: () => '/admin',
}
