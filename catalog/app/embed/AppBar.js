import * as React from 'react'
import { useHistory, Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'

import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'
import { useRoute } from 'utils/router'

const useSearchBoxStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0.1),
    borderRadius: t.shape.borderRadius,
    color: t.palette.common.white,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    transition: ['background-color 200ms', 'width 200ms'],
    width: t.spacing(24),
    '&:hover': {
      background: fade(t.palette.common.white, 0.2),
    },
  },
  focused: {
    background: `${fade(t.palette.common.white, 0.2)} !important`,
    width: '100%',
  },
  input: {
    paddingLeft: t.spacing(4),
    paddingTop: 8,
    paddingBottom: 9,
    textOverflow: 'ellipsis',
  },
  adornment: {
    cursor: 'pointer',
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'absolute',
    width: t.spacing(4),
  },
}))

function SearchBox({ bucket }) {
  const history = useHistory()
  const { paths, urls } = NamedRoutes.use()

  const { location: l, match } = useRoute(paths.bucketSearch)
  const query = (match && parse(l.search).q) || ''

  const makeUrl = React.useCallback((q) => urls.bucketSearch(bucket, q), [urls, bucket])

  const [value, change] = React.useState(null)
  const [focused, setFocused] = React.useState(false)

  const handleChange = React.useCallback(
    (evt) => {
      change(evt.target.value)
    },
    [change],
  )

  const handleKeyDown = React.useCallback(
    (evt) => {
      // eslint-disable-next-line default-case
      switch (evt.key) {
        case 'Enter':
          if (query !== value) {
            history.push(makeUrl(value))
          }
          evt.target.blur()
          break
        case 'Escape':
          evt.target.blur()
          break
      }
    },
    [history, makeUrl, value, query],
  )

  const handleFocus = React.useCallback(() => {
    change(query)
    setFocused(true)
  }, [query, change, setFocused])

  const handleBlur = React.useCallback(() => {
    change(null)
    setFocused(false)
  }, [change, setFocused])

  const { adornment, ...classes } = useSearchBoxStyles()

  return (
    <M.InputBase
      value={value === null ? query : value}
      startAdornment={
        <M.InputAdornment className={adornment}>
          <M.Icon>search</M.Icon>
        </M.InputAdornment>
      }
      classes={classes}
      placeholder={focused ? `Search s3://${bucket}` : 'Search'}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  appBar: {
    zIndex: t.zIndex.appBar + 1,
  },
  link: {
    ...t.typography.body1,
  },
}))

export default function AppBar({ bucket }) {
  const trigger = M.useScrollTrigger()
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  return (
    <>
      <M.Toolbar />
      <M.Slide appear={false} direction="down" in={!trigger}>
        <M.AppBar className={classes.appBar}>
          <M.Toolbar disableGutters>
            <M.Container maxWidth="lg" style={{ display: 'flex' }}>
              <Link to={urls.bucketDir(bucket)} className={classes.link}>
                s3://{bucket}
              </Link>
              <M.Box
                display="flex"
                alignItems="center"
                position="relative"
                flexGrow={1}
                ml={2}
              >
                <SearchBox bucket={bucket} />
              </M.Box>
            </M.Container>
          </M.Toolbar>
        </M.AppBar>
      </M.Slide>
    </>
  )
}
