import { basename } from 'path'

import * as React from 'react'
import { useHistory, useRouteMatch, Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'

import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'
import { useRoute } from 'utils/router'

import * as EmbedConfig from './EmbedConfig'

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

  const makeUrl = React.useCallback((q) => urls.bucketSearch(bucket, { q }), [
    urls,
    bucket,
  ])

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
  btn: {
    color: t.palette.common.white,
    backgroundColor: fade(t.palette.common.white, 0.1),
    '&:hover': {
      backgroundColor: fade(t.palette.common.white, 0.2),
      // Reset on touch devices, it doesn't add specificity
      '@media (hover: none)': {
        backgroundColor: fade(t.palette.common.white, 0.1),
      },
    },
  },
}))

export default function AppBar({ bucket }) {
  const cfg = EmbedConfig.use()
  const trigger = M.useScrollTrigger()
  const classes = useStyles()
  const { urls, paths } = NamedRoutes.use()
  const isSearch = !!useRouteMatch(paths.bucketSearch)
  const rootUrl = urls.bucketDir(bucket, cfg.scope)
  const showRootLink = !cfg.hideRootLink || isSearch
  return (
    <>
      <M.Toolbar />
      <M.Slide appear={false} direction="down" in={!trigger}>
        <M.AppBar className={classes.appBar}>
          <M.Toolbar disableGutters>
            <M.Container maxWidth="lg" style={{ display: 'flex' }}>
              {showRootLink && (
                <M.Button
                  to={rootUrl}
                  component={Link}
                  variant="contained"
                  className={classes.btn}
                >
                  {cfg.hideRootLink && isSearch ? ( // eslint-disable-line no-nested-ternary
                    <>
                      <M.Icon style={{ fontSize: 16, marginLeft: -2 }}>
                        arrow_back_ios
                      </M.Icon>{' '}
                      Back
                    </>
                  ) : cfg.scope ? (
                    basename(cfg.scope)
                  ) : (
                    `s3://${bucket}`
                  )}
                </M.Button>
              )}
              <M.Box
                display="flex"
                alignItems="center"
                position="relative"
                flexGrow={1}
                ml={showRootLink ? 2 : undefined}
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
