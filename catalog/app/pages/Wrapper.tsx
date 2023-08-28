import * as React from 'react'
import { Outlet } from 'react-router-dom'

import * as Auth from 'containers/Auth'
import * as Tracking from 'utils/tracking'

export default function PagesWrapper() {
  return (
    <Tracking.Provider userSelector={Auth.selectors.username}>
      <Outlet />
    </Tracking.Provider>
  )
}
