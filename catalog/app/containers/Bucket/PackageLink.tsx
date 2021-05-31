import * as React from 'react'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'

const useStyles = M.makeStyles({
  name: {
    wordBreak: 'break-all',
  },
})

interface PackageLinkProps {
  bucket: string
  name: string
}

export default function PackageLink({ bucket, name }: PackageLinkProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const [prefix, suffix] = name.split('/')
  return (
    <span className={classes.name}>
      <Link to={urls.bucketPackageList(bucket, { filter: `${prefix}/` })}>{prefix}/</Link>
      <Link to={urls.bucketPackageDetail(bucket, name)}>{suffix}</Link>
    </span>
  )
}
