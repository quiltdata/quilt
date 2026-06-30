import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'

import Layout from 'website/components/Layout'

import Buckets from './Buckets'
import Search from './Search'

const useStyles = M.makeStyles((t) => ({
  buckets: {
    background: t.palette.primary.dark,
    paddingBottom: t.spacing(8),
  },
}))

export default function OpenLanding() {
  const classes = useStyles()
  return (
    <Layout>
      <MetaTitle />
      <Search />
      <div className={classes.buckets}>
        <M.Divider />
        <Buckets />
      </div>
    </Layout>
  )
}
