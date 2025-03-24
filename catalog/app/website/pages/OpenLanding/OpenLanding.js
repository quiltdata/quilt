import * as React from 'react'
import * as M from '@material-ui/core'

// TODO: decouple NavBar layout/state from gql and auth calls
//       and place it into components/SearchBar
import * as NavBar from 'containers/NavBar'

import * as LinkedData from 'utils/LinkedData'
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
      <React.Suspense fallback={null}>
        <LinkedData.CatalogData />
      </React.Suspense>
      <NavBar.Provider>
        <Search />
      </NavBar.Provider>
      <div className={classes.buckets}>
        <M.Divider />
        <Buckets />
      </div>
    </Layout>
  )
}
