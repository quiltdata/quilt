import type * as React from 'react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as MUI from '@material-ui/core'

declare module '@material-ui/core' {
  // workaround for MUI@4 not having ref in BoxProps
  // https://github.com/mui-org/material-ui/issues/17010
  interface BoxProps {
    ref?: React.Ref<any>
  }
}
