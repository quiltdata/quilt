import { push } from 'connected-react-router/esm/immutable'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import img2x from 'utils/img2x'

import Dots from 'website/components/Backgrounds/Dots'

import bg from './search-bg.png'
import bg2x from './search-bg@2x.png'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  container: {
    position: 'relative',
    '&::before': {
      background: `center -260px / 1120px no-repeat url(${img2x(bg, bg2x)})`,
      bottom: 0,
      content: '""',
      left: 0,
      opacity: 0.5,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  },
  inner: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 650,
    paddingTop: t.spacing(23),
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      paddingTop: t.spacing(20),
    },
  },
  inputRoot: {
    background: t.palette.common.white,
    borderRadius: t.typography.pxToRem(30),
    color: t.palette.getContrastText(t.palette.common.white),
    fontSize: t.typography.pxToRem(20),
    lineHeight: t.typography.pxToRem(60),
    maxWidth: 750,
    width: '100%',
  },
  inputInput: {
    height: 'auto',
    paddingBottom: 0,
    paddingLeft: t.spacing(9),
    paddingRight: t.spacing(4),
    paddingTop: 0,
  },
  adornment: {
    color: t.palette.grey[600],
    justifyContent: 'center',
    left: t.spacing(3),
    pointerEvents: 'none',
    position: 'absolute',
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: t.spacing(8),
    maxWidth: 860,
    width: '100%',
    [t.breakpoints.down('xs')]: {
      flexDirection: 'column',
      height: t.spacing(30),
    },
  },
  stat: {
    alignItems: 'center',
    color: t.palette.common.white,
    display: 'flex',
    flexDirection: 'column',
    textShadow: `0 3px 2px rgba(0, 0, 0, 0.2)`,
  },
  statValue: {
    fontSize: t.typography.pxToRem(48),
    fontWeight: t.typography.fontWeightBold,
    lineHeight: 1,
    [t.breakpoints.down('sm')]: {
      fontSize: t.typography.pxToRem(36),
    },
  },
  statDesc: {
    fontSize: t.typography.pxToRem(24),
    fontWeight: t.typography.fontWeightRegular,
    lineHeight: 1.5,
    opacity: 0.8,
    [t.breakpoints.down('sm')]: {
      fontSize: t.typography.pxToRem(16),
    },
  },
}))

export default function Search() {
  const classes = useStyles()

  const dispatch = redux.useDispatch()
  const { urls } = NamedRoutes.use()
  const [value, change] = React.useState('')

  const onChange = React.useCallback((evt) => {
    change(evt.target.value)
  }, [])

  const onKeyDown = React.useCallback(
    (evt) => {
      // eslint-disable-next-line default-case
      switch (evt.key) {
        case 'Enter':
          dispatch(push(urls.search({ q: value })))
          break
        case 'Escape':
          evt.target.blur()
          break
      }
    },
    [dispatch, urls, value],
  )

  return (
    <div className={classes.root}>
      <Dots />
      <M.Container maxWidth="lg" className={classes.container}>
        <div className={classes.inner}>
          <M.InputBase
            {...{ value, onChange, onKeyDown }}
            startAdornment={
              <M.InputAdornment className={classes.adornment}>
                <M.Icon fontSize="large">search</M.Icon>
              </M.InputAdornment>
            }
            classes={{ root: classes.inputRoot, input: classes.inputInput }}
            placeholder="Search"
            // TODO: bucket select dropdown
          />
          <div className={classes.stats}>
            <div className={classes.stat}>
              <div className={classes.statValue}>10 Billion</div>
              <div className={classes.statDesc}>Objects</div>
            </div>
            <div className={classes.stat}>
              <div className={classes.statValue}>1.4 Petabytes</div>
              <div className={classes.statDesc}>Of Data</div>
            </div>
            <div className={classes.stat}>
              <div className={classes.statValue}>100</div>
              <div className={classes.statDesc}>S3 Buckets</div>
            </div>
          </div>
        </div>
      </M.Container>
    </div>
  )
}
