// workaround for MUI@4 not having ref in BoxProps
// https://github.com/mui-org/material-ui/issues/17010
import type { BoxProps } from '@material-ui/core'
declare module '@material-ui/core' {
  interface BoxProps {
    ref?: React.Ref<any>
  }
}
