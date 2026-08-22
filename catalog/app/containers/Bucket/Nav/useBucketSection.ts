import * as React from 'react'
import { matchPath, useLocation } from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import type { RouteMap } from '../Routes'

export type Section = 'overview' | 'packages' | 'tree' | 'workflows'

export function useBucketSection() {
  const location = useLocation()
  const { paths } = NamedRoutes.use<RouteMap>()
  return React.useMemo(() => {
    if (matchPath(location.pathname, { path: paths.bucketOverview, exact: true })) {
      return 'overview'
    }
    if (matchPath(location.pathname, { path: paths.bucketPackageList })) {
      return 'packages'
    }
    if (
      matchPath(location.pathname, { path: paths.bucketFile, exact: true, strict: true })
    ) {
      return 'tree'
    }
    if (matchPath(location.pathname, { path: paths.bucketDir, exact: true })) {
      return 'tree'
    }
    if (matchPath(location.pathname, { path: paths.bucketWorkflowList })) {
      return 'workflows'
    }
    return false
  }, [location.pathname, paths])
}
