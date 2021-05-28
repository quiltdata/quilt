import * as React from 'react'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'

import RevisionInfo from './RevisionInfo'

const useStyles = M.makeStyles({
  name: {
    wordBreak: 'break-all',
  },
})

interface PackageLinkProps {
  bucket: string
  name: string
  path: string
  revision: string
  revisionListKey: number
  revisionData: $TSFixMe
}

export default function PackageLink({
  bucket,
  name,
  path,
  revision,
  revisionListKey,
  revisionData,
}: PackageLinkProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const nameParts = name.split('/')
  return (
    <M.Typography variant="body1">
      <Link
        to={urls.bucketPackageList(bucket, { filter: nameParts[0] })}
        className={classes.name}
      >
        {nameParts[0]}
      </Link>
      /
      <Link to={urls.bucketPackageDetail(bucket, name)} className={classes.name}>
        {nameParts[1]}
      </Link>
      {' @ '}
      <RevisionInfo
        {...{ revisionData, revision, bucket, name, path }}
        key={`revinfo:${revisionListKey}`}
      />
    </M.Typography>
  )
}
