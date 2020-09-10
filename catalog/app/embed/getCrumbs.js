import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'

import { Crumb } from 'components/BreadCrumbs'
import * as s3paths from 'utils/s3paths'

export default ({ bucket, path, urls, scope, excludeBase = false }) => {
  const scoped = scope && path.startsWith(scope)
  const scopedPath = scoped ? path.substring(scope.length) : path
  const root = { label: scoped ? basename(scope) : 'ROOT', path: '' }
  const start = excludeBase ? s3paths.up(scopedPath) : scopedPath
  const items = [root, ...s3paths.getBreadCrumbs(start)].map(({ label, path: segPath }) =>
    Crumb.Segment({
      label,
      to:
        segPath === scopedPath
          ? undefined
          : urls.bucketDir(bucket, `${scoped ? scope : ''}${segPath}`),
    }),
  )
  const interspersed = R.intersperse(Crumb.Sep(<>&nbsp;/ </>), items)
  return excludeBase ? [...interspersed, Crumb.Sep(<>&nbsp;/</>)] : interspersed
}
