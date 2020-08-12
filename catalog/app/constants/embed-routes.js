import { mkSearch } from 'utils/NamedRoutes'
import { encode } from 'utils/s3paths'

//export const home = {
  //path: '/',
  //url: () => '/',
//}

// bucket
// TODO: check if this works w/o trailing slash
export const bucketRoot = {
  path: '/b/:bucket',
  url: (bucket) => `/b/${bucket}`,
}
export const bucketFile = {
  path: '/b/:bucket/:path+',
  url: (bucket, path, version) =>
    `/b/${bucket}/${encode(path)}${mkSearch({ version })}`,
}
export const bucketDir = {
  path: '/b/:bucket/:path(.+/)?',
  url: (bucket, path = '') => `/b/${bucket}/${encode(path)}`,
}
