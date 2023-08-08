import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'

const useStyles = M.makeStyles({
  name: {
    wordBreak: 'break-all',
  },
})

interface PackageLinkProps {
  handle: Model.Package.Handle
}

export default function PackageLink({ handle }: PackageLinkProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const [prefix, suffix] = handle.name.split('/')
  return (
    <span className={classes.name}>
      <Link to={urls.bucketPackageList(handle.bucket, { filter: `${prefix}/` })}>
        {prefix}/
      </Link>
      <Link to={urls.bucketPackageDetail(handle)}>{suffix}</Link>
    </span>
  )
}
