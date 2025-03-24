import * as React from 'react'
import * as M from '@material-ui/core'

// TODO: decouple NavBar layout/state from gql and auth calls
//       and place it into components/SearchBar
import { useNavBar } from 'containers/NavBar/Provider'
import Suggestions from 'containers/NavBar/Suggestions'

import * as BucketConfig from 'utils/BucketConfig'
import img2x from 'utils/img2x'

import Dots from 'website/components/Backgrounds/Dots'

import bg from './search-bg.png'
import bg2x from './search-bg@2x.png'

const useHelpStyles = M.makeStyles((t) => ({
  paper: {
    borderRadius: t.spacing(0.5),
    marginTop: t.spacing(8),
    maxWidth: 690,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
}))

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
    overflow: 'hidden',
    paddingLeft: 0,
    width: '100%',
  },
  inputInput: {
    height: 'auto',
    padding: t.spacing(0, 4, 0, 9.5),
  },
  inputOptions: {
    borderColor: t.palette.grey[300],
    borderRadius: 0,
    borderWidth: '0 1px 0 0',
    color: t.palette.grey[600],
    padding: t.spacing(1.5, 1.5, 1.5, 3),
  },
  inputOptionsSelected: {
    boxShadow: 'inset -1px 0 4px rgba(0, 0, 0, 0.2)',
  },
  inputWrapper: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  adornment: {
    justifyContent: 'center',
    position: 'absolute',
    height: 'auto',
    maxHeight: '100%',
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
  icon: {
    marginLeft: t.spacing(3.5),
    opacity: 0.5,
  },
}))

export default function Search() {
  const classes = useStyles()
  const helpClasses = useHelpStyles()

  // XXX: consider using graphql directly
  const bucketCount = BucketConfig.useRelevantBucketConfigs().length

  const { input, onClickAway } = useNavBar()
  const ref = React.useRef(null)
  const focus = React.useCallback(() => ref.current?.focus(), [])

  return (
    <div className={classes.root}>
      <Dots />
      <M.Container maxWidth="lg" className={classes.container}>
        <div className={classes.inner}>
          <M.ClickAwayListener onClickAway={onClickAway}>
            <div className={classes.inputWrapper}>
              <M.InputBase
                {...input}
                startAdornment={
                  <M.InputAdornment className={classes.adornment}>
                    <M.Icon className={classes.icon} onClick={focus}>
                      search
                    </M.Icon>
                  </M.InputAdornment>
                }
                classes={{ root: classes.inputRoot, input: classes.inputInput }}
                placeholder="Search"
                ref={ref}
              />
              <Suggestions classes={helpClasses} open={input.helpOpen} />
            </div>
          </M.ClickAwayListener>

          <div className={classes.stats}>
            <div className={classes.stat}>
              <div className={classes.statValue}>477 Million</div>
              <div className={classes.statDesc}>Objects</div>
            </div>
            <div className={classes.stat}>
              <div className={classes.statValue}>1.3 Petabytes</div>
              <div className={classes.statDesc}>Of Data</div>
            </div>
            <div className={classes.stat}>
              <div className={classes.statValue}>{bucketCount}</div>
              <div className={classes.statDesc}>S3 Buckets</div>
            </div>
          </div>
        </div>
      </M.Container>
    </div>
  )
}
