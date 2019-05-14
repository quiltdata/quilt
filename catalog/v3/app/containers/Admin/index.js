import * as React from 'react'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/styles'

import Layout from 'components/Layout'
import * as APIConnector from 'utils/APIConnector'
import * as Cache from 'utils/ResourceCache'

import Roles from './Roles'
import Users from './Users'
import * as data from './data'

const useStyles = makeStyles((t) => ({
  section: {
    marginTop: t.spacing.unit * 2,
  },
}))

export default () => {
  const classes = useStyles()
  const req = APIConnector.use()
  const users = Cache.useData(data.UsersResource, { req })
  const roles = Cache.useData(data.RolesResource, { req })
  return (
    <Layout>
      <div className={classes.section}>
        <Typography variant="h4">Users and roles</Typography>
      </div>
      <div className={classes.section}>
        <Users users={users} roles={roles} />
      </div>
      <div className={classes.section}>
        <Roles roles={roles} />
      </div>
    </Layout>
  )
}
