import * as M from '@material-ui/core'

export const Section = M.styled(M.Paper)(({ theme: t }) => ({
  position: 'relative',
  [t.breakpoints.down('xs')]: {
    borderRadius: 0,
    padding: t.spacing(2),
  },
  [t.breakpoints.up('sm')]: {
    marginTop: t.spacing(2),
    padding: t.spacing(4),
    paddingTop: t.spacing(3),
  },
}))

export const Heading = M.styled(M.Box)(({ theme: t }) => ({
  ...t.typography.h6,
  lineHeight: 1.4,
  marginBottom: t.spacing(1),
  [t.breakpoints.up('sm')]: {
    marginBottom: t.spacing(2),
  },
  [t.breakpoints.up('md')]: {
    ...t.typography.h5,
  },
}))
