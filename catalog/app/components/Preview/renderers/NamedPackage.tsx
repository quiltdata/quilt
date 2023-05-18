import 'highlight.js/styles/default.css'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  text: {
    fontFamily: t.typography.monospace.fontFamily,
    overflow: 'auto',
    whiteSpace: 'pre',
  },
}))

interface NamedPackageProps extends React.HTMLAttributes<HTMLDivElement> {
  bucket: string
  hash: string
  note?: string
  warnings?: string
}

function NamedPackage({
  bucket,
  className,
  children,
  hash,
  note,
  warnings,
  ...props
}: NamedPackageProps) {
  const { urls } = NamedRoutes.use()
  const classes = useStyles()
  return (
    <div className={className} {...props}>
      <StyledLink to={urls.bucketFile(bucket, `.quilt/packages/${hash}`)}>
        {hash}
      </StyledLink>
      {renderWarnings(warnings)}
      <div title={note} className={classes.text}>
        {children}
      </div>
    </div>
  )
}

export default (
  { bucket, hash, note, warnings }: NamedPackageProps,
  props: NamedPackageProps,
) => <NamedPackage {...{ bucket, hash, note, warnings }} {...props} />
