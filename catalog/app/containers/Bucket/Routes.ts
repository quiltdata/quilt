import * as Eff from 'effect'
import { Schema as S } from 'effect'
import invariant from 'invariant'
import { useParams } from 'react-router-dom'

import * as routes from 'constants/routes'
// import * as Model from 'model'
import * as Nav from 'utils/Navigation'

export interface RouteMap {
  bucketDir: routes.BucketDirArgs
  bucketESQueries: routes.BucketESQueriesArgs
  bucketFile: routes.BucketFileArgs
  bucketOverview: routes.BucketOverviewArgs
  bucketPackageDetail: routes.BucketPackageDetailArgs
  bucketPackageList: routes.BucketPackageListArgs
  bucketPackageRevisions: routes.BucketPackageRevisionsArgs
  bucketPackageTree: routes.BucketPackageTreeArgs
  bucketQueries: routes.BucketQueriesArgs
  bucketWorkflowDetail: routes.BucketWorkflowDetailArgs
  bucketWorkflowList: routes.BucketWorkflowListArgs
}

export function useBucketSafe() {
  const { bucket } = useParams<{ bucket?: string }>()
  return bucket
}

export function useBucketStrict() {
  const bucket = useBucketSafe()
  invariant(!!bucket, '`bucket` must be defined')
  return bucket
}

const BucketPathParams = S.Struct({
  // XXX: constraints?
  bucket: S.String,
})

export const overview = Nav.makeRoute({
  name: 'bucket.overview',
  path: routes.bucketOverview.path,
  description: 'Bucket overview page',
  pathParams: Nav.fromPathParams(BucketPathParams),
})

const PATH_SEP = '/'

const mapSegments = (separator: string, map: (s: string) => string) =>
  Eff.flow(Eff.String.split(separator), Eff.Array.map(map), Eff.Array.join(separator))

const S3Path = S.brand('S3Path')(S.String)

const S3PathFromString = (S3PathSchema: typeof S3Path) =>
  S.transform(S.String, S3PathSchema, {
    encode: mapSegments(PATH_SEP, encodeURIComponent),
    strict: true,
    decode: mapSegments(PATH_SEP, decodeURIComponent),
  })

export const s3Object = Nav.makeRoute({
  name: 'bucket.object',
  path: routes.bucketFile.path,
  exact: true,
  strict: true,
  description: 'S3 Object (aka File) page',
  waitForMarkers: ['versionsReady', 'currentVersionReady'],
  pathParams: Nav.fromPathParams(
    S.extend(
      BucketPathParams,
      S.Struct({
        path: S3Path.annotations({
          title: 'Path',
          description: 'S3 Object Key aka File Path',
        }).pipe(S3PathFromString),
      }),
    ),
  ),
  searchParams: S.Struct({
    version: Nav.SearchParamLastOpt.annotations({
      title: 'Version ID',
      description: 'S3 Object Version ID (omit for latest version)',
    }),
    // XXX: constrain?
    mode: Nav.SearchParamLastOpt.annotations({
      title: 'Viewing Mode',
      description: 'Contents preview mode',
    }),
    // add: Nav.SearchParamLastOpt.annotations({ title: 'add' }), // ignore for now
    // edit: S.optional(S.Boolean),
    // next: S.optional(S.String), // ignore for now
  }),
})

export const s3Prefix = Nav.makeRoute({
  name: 'bucket.prefix',
  path: routes.bucketDir.path,
  exact: true,
  description: 'S3 Prefix (aka Directory) page',
  waitForMarkers: ['listingReady'],
  pathParams: Nav.fromPathParams(
    S.extend(
      BucketPathParams,
      S.Struct({
        path: S3Path.annotations({
          title: 'Path',
          description: 'S3 Prefix aka Directory Path',
        }).pipe(S3PathFromString),
      }),
    ),
  ),
})

// interface BucketPackageListOpts {
//   filter?: string
//   sort?: string
//   p?: string
// }
//
// export const bucketPackageList = route(
//   '/b/:bucket/packages/',
//   (bucket: string, { filter, sort, p }: BucketPackageListOpts = {}) =>
//     `/b/${bucket}/packages/${mkSearch({ filter, sort, p })}`,
// )
// export type BucketPackageListArgs = Parameters<typeof bucketPackageList.url>
//
// interface BucketPackageDetailOpts {
//   action?: string
// }
//
// export const bucketPackageDetail = route(
//   `/b/:bucket/packages/:name(${PACKAGE_PATTERN})`,
//   (bucket: string, name: string, { action }: BucketPackageDetailOpts = {}) =>
//     `/b/${bucket}/packages/${name}${mkSearch({ action })}`,
// )
// export type BucketPackageDetailArgs = Parameters<typeof bucketPackageDetail.url>
//
// export const bucketPackageTree = route(
//   `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/tree/:revision/:path(.*)?`,
//   (bucket: string, name: string, revision?: string, path: string = '', mode?: string) =>
//     path || (revision && revision !== 'latest')
//       ? `/b/${bucket}/packages/${name}/tree/${revision || 'latest'}/${encode(
//           path,
//         )}${mkSearch({ mode })}`
//       : bucketPackageDetail.url(bucket, name),
// )
// export type BucketPackageTreeArgs = Parameters<typeof bucketPackageTree.url>
//
// interface BucketPackageRevisionsOpts {
//   p?: string
// }
//
// export const bucketPackageRevisions = route(
//   `/b/:bucket/packages/:name(${PACKAGE_PATTERN})/revisions`,
//   (bucket: string, name: string, { p }: BucketPackageRevisionsOpts = {}) =>
//     `/b/${bucket}/packages/${name}/revisions${mkSearch({ p })}`,
// )
//
// export const bucketQueries = route(
//   '/b/:bucket/queries',
//   (bucket: string) => `/b/${bucket}/queries`,
// )
//
// export const bucketESQueries = route(
//   '/b/:bucket/queries/es',
//   (bucket: string) => `/b/${bucket}/queries/es`,
// )
//
// export const bucketAthena = route(
//   '/b/:bucket/queries/athena',
//   (bucket: string) => `/b/${bucket}/queries/athena`,
// )
//
// export const bucketAthenaWorkgroup = route(
//   '/b/:bucket/queries/athena/:workgroup',
//   (bucket: string, workgroup: string) => `/b/${bucket}/queries/athena/${workgroup}`,
// )
//
// export const bucketAthenaExecution = route(
//   '/b/:bucket/queries/athena/:workgroup/:queryExecutionId',
//   (bucket: string, workgroup: string, queryExecutionId: string) =>
//     `/b/${bucket}/queries/athena/${workgroup}/${queryExecutionId}`,

export default [s3Object, s3Prefix, overview]
