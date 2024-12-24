import type * as React from 'react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as MUI from '@material-ui/core'
import type { FontStyle } from '@material-ui/core/styles/createTypography'

declare module '@material-ui/core' {
  // workaround for MUI@4 not having ref in BoxProps
  // https://github.com/mui-org/material-ui/issues/17010
  interface BoxProps {
    ref?: React.Ref<any>
  }
}

declare module '@material-ui/core/styles/createTypography' {
  interface Typography {
    monospace: FontStyle
  }
}
