import * as React from 'react'
import * as M from '@material-ui/core'

import * as NavMenu from 'containers/NavBar/NavMenu'
import * as Subscription from 'containers/NavBar/Subscription'

export function AccountZone() {
  const subscription = Subscription.useState()

  return (
    <M.List disablePadding>
      {subscription.invalid && (
        <M.ListItem>
          <M.ListItemIcon>
            <M.Icon color="error">warning</M.Icon>
          </M.ListItemIcon>
          <M.ListItemText primary="Unlicensed" />
        </M.ListItem>
      )}
      <M.ListItem>
        <NavMenu.Menu collapse={false} />
      </M.ListItem>
    </M.List>
  )
}
