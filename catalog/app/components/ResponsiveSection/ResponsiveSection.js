import * as M from '@material-ui/core'

import * as Column from 'components/Layout/Column'

export const Section = M.styled(M.Paper)(({ theme: t }) => ({
  position: 'relative',
  [Column.down('xs')]: {
    borderRadius: 0,
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
  },
  [Column.up('sm')]: {
    marginTop: t.spacing(2),
    padding: t.spacing(4),
    paddingTop: t.spacing(3),
  },
}))

export const Heading = M.styled(M.Box)(({ theme: t }) => ({
  ...t.typography.h6,
  lineHeight: 1.4,
  marginBottom: t.spacing(1),
  [Column.up('sm')]: {
    marginBottom: t.spacing(2),
  },
  [Column.up('md')]: {
    ...t.typography.h5,
  },
}))
