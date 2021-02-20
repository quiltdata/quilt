import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

const useStyles = M.makeStyles(() => ({
  h1: {
    background: '#900',
  },
}))

export default function Queries() {
  const classes = useStyles()

  return (
    <Layout>
      <h1 className={classes.h1}>It works</h1>
    </Layout>
  )
}
