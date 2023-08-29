import invariant from 'invariant'
import * as React from 'react'
import { Outlet, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 0),
  },
}))

export default function Queries() {
  const { bucket } = useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  const classes = useStyles()
  return (
    <div className={classes.root}>
      <MetaTitle>{['Queries', bucket]}</MetaTitle>
      <Outlet />
    </div>
  )
}
