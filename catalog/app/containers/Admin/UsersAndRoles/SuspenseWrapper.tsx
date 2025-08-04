import * as React from 'react'
import * as M from '@material-ui/core'

import * as Table from '../Table'

interface SuspenseWrapperProps {
  children: React.ReactNode
  heading: React.ReactNode
}

export default function SuspenseWrapper({ children, heading }: SuspenseWrapperProps) {
  return (
    <M.Paper>
      <React.Suspense
        fallback={
          <>
            <Table.Toolbar heading={heading} />
            <Table.Progress />
          </>
        }
      >
        {children}
      </React.Suspense>
    </M.Paper>
  )
}
