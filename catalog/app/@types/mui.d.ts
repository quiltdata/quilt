import type * as React from 'react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as MUI from '@material-ui/core'
import type { FontStyle } from '@material-ui/core/styles/createTypography'
import type { CSSProperties } from '@material-ui/core/styles/withStyles'

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

declare module '@material-ui/core/styles/createMixins' {
  // Quilt-specific mixin (see constants/style)
  interface Mixins {
    lineClamp: (lines: number) => CSSProperties
  }
}
