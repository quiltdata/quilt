import * as React from 'react'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'

import SUBSCRIPTION_QUERY from './gql/Subscription.generated'

const useStyles = M.makeStyles({
  root: {
    width: '100px',
  },
})

export default function Subscription() {
  const classes = useStyles()
  const data = GQL.useQuery(SUBSCRIPTION_QUERY)
  const sub = GQL.fold(data, {
    fetching: () => null,
    error: () => null,
    data: (d) => d.subscription,
  })
  return (
    sub && (
      <div className={classes.root}>
        subscription: {sub.active ? 'active' : 'inactive'}
      </div>
    )
  )
}
