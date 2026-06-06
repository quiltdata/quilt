import type * as React from 'react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars, import/no-duplicates
import type * as MUI from '@material-ui/core'
// eslint-disable-next-line import/no-duplicates
import type { Theme } from '@material-ui/core'
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

// We loosen MUI@4's makeStyles only in the dimensions that fight TS@5 here:
// the props/theme typing (callback styles get an untyped theme) and the
// options bag. Class-key inference is preserved — the returned `classes`
// object is keyed by the actual style names, so a typo like `classes.heder`
// is still a type error rather than silently `undefined`.
declare module '@material-ui/styles/makeStyles' {
  export default function makeStyles<ClassKey extends string = string>(
    styles: Record<ClassKey, any> | ((theme: Theme) => Record<ClassKey, any>),
    options?: any,
  ): (props?: any) => Record<ClassKey, string>
}

declare module '@material-ui/core/styles' {
  export function makeStyles<ClassKey extends string = string>(
    styles: Record<ClassKey, any> | ((theme: Theme) => Record<ClassKey, any>),
    options?: any,
  ): (props?: any) => Record<ClassKey, string>
}
