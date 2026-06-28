import type * as React from 'react'
import * as M from '@material-ui/core'

export const Section = M.styled(M.Paper)(({ theme: t }) => ({
  position: 'relative',
  [t.breakpoints.down('xs')]: {
    borderRadius: 0,
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
  },
  [t.breakpoints.up('sm')]: {
    marginTop: t.spacing(2),
    padding: t.spacing(4),
    paddingTop: t.spacing(3),
  },
}))

export const Heading = M.styled(M.Box)(({ theme: t }) => ({
  // theme.typography.* carries a string index signature that MUI's styled
  // CSSProperties does not accept; React.CSSProperties has no such index, so
  // casting the spreads through it keeps the values and drops the index.
  ...(t.typography.h6 as React.CSSProperties),
  lineHeight: 1.4,
  marginBottom: t.spacing(1),
  [t.breakpoints.up('sm')]: {
    marginBottom: t.spacing(2),
  },
  [t.breakpoints.up('md')]: {
    ...(t.typography.h5 as React.CSSProperties),
  },
}))
