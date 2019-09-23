import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'

import art from './art.png'
import art2x from './art@2x.png'

const usePanelStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: '#33346e',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    marginBottom: t.spacing(3),
    overflow: 'hidden',
    width: '100%',
  },
  text: {
    alignItems: 'center',
    color: t.palette.common.white,
    display: 'flex',
    fontSize: '1.75rem',
    fontWeight: t.typography.fontWeightBold,
    height: 150,
    lineHeight: '2rem',
    textAlign: 'center',
  },
  line: {
    height: 10,
    width: '100%',
  },
  primary: {
    background: 'linear-gradient(to right, #c47e70, #efcda3, #c47e70)',
  },
  secondary: {
    background: 'linear-gradient(to right, #4142ad, #946add, #4142ad)',
  },
  tertiary: {
    background: 'linear-gradient(to right, #236f9a, #77caab, #236f9a)',
  },
}))

function Panel({ color, children }) {
  const classes = usePanelStyles()
  return (
    <div className={classes.root}>
      <div className={classes.text}>{children}</div>
      <div className={cx(classes.line, classes[color])} />
    </div>
  )
}

const Link = ({ children, ...props }) => (
  <M.Link color="textPrimary" underline="none" variant="body1" {...props}>
    {children}
    <M.Icon color="primary" style={{ verticalAlign: 'middle' }}>
      chevron_right
    </M.Icon>
  </M.Link>
)

const useStyles = M.makeStyles((t) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto',
    gridColumnGap: t.spacing(5),
    [t.breakpoints.down('xs')]: {
      gridRowGap: t.spacing(8),
      gridTemplateColumns: 'auto',
      gridTemplateRows: 'auto auto auto',
    },
  },
  col: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  art: {
    width: 380,
    [t.breakpoints.down('xs')]: {
      maxWidth: 380,
      width: '100%',
    },
  },
}))

export default function Contribute() {
  const classes = useStyles()
  return (
    <M.Container maxWidth="lg">
      <M.Box pt={12} pb={9}>
        <M.Typography variant="h1" color="textPrimary" align="center">
          Contribute to Quilt
        </M.Typography>
        <M.Typography variant="body1" color="textSecondary" align="center">
          There are three ways that you can contribute to Quilt
        </M.Typography>
      </M.Box>
      <div className={classes.grid}>
        <div className={classes.col}>
          <Panel color="tertiary">Curate data</Panel>
          <Link href="https://forms.gle/oNoiRYDxnkZEnppq7">Apply now</Link>
        </div>
        <div className={classes.col}>
          <Panel color="primary">Write code</Panel>
          <Link href="https://github.com/quiltdata/quilt">View on GitHub</Link>
        </div>
        <div className={classes.col}>
          <Panel color="secondary">Run your own quilt</Panel>
          <Link href="https://quiltdata.com">Learn more</Link>
        </div>
      </div>
      <M.Box display="flex" pt={10} pb={13} flexDirection={{ xs: 'column', sm: 'row' }}>
        <img src={img2x(art, art2x)} className={classes.art} alt="" />
        <M.Box ml={{ sm: 14 }} mt={15}>
          <M.Typography variant="h2" color="textPrimary">
            Get notified
          </M.Typography>
          <M.Box pt={4} />
          <M.Typography variant="body1" color="textSecondary">
            Quilt is evolving Join our{' '}
            <M.Link
              href="https://groups.google.com/forum/#!forum/quilt-data-dev/"
              color="secondary"
              underline="always"
            >
              <b>developer mailing list</b>
            </M.Link>
            {' or '}
            <M.Link color="secondary" underline="always" href="http://eepurl.com/bOyxRz">
              <b>general mailing list</b>
            </M.Link>{' '}
            to discuss new features, ask questions, and stay in the loop.
          </M.Typography>
        </M.Box>
      </M.Box>
    </M.Container>
  )
}
