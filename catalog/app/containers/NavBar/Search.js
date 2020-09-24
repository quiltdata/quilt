import cx from 'classnames'
import { push } from 'connected-react-router/esm/immutable'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'

import * as style from 'constants/style'
import * as Config from 'utils/Config'
import * as BucketConfig from 'utils/BucketConfig'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'
import { useRoute } from 'utils/router'
import StyledLink from 'utils/StyledLink'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0),
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    transition: ['background-color 200ms', 'opacity 200ms', 'width 200ms'],
    width: t.spacing(24),
    '&:not($iconized)': {
      background: fade(t.palette.common.white, 0.1),
    },
    '&:not($disabled):not($iconized):hover': {
      background: fade(t.palette.common.white, 0.2),
    },
  },
  iconized: {
    width: t.spacing(4),
  },
  disabled: {
    opacity: 0.8,
  },
  hidden: {
    opacity: 0,
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
    transition: ['opacity 200ms'],
    '$iconized:not($focused) &': {
      opacity: 0,
    },
  },
  adornment: {
    cursor: 'pointer',
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'absolute',
    width: t.spacing(4),
  },
}))

function SearchBox({
  bucket,
  disabled,
  iconized,
  hidden,
  focused,
  helpOpened,
  onHelpClose,
  onHelpOpen,
  ...props
}) {
  const {
    adornment,
    disabled: disabledCls,
    iconized: iconizedCls,
    hidden: hiddenCls,
    ...classes
  } = useStyles()
  return (
    <M.InputBase
      startAdornment={
        <M.InputAdornment className={adornment}>
          <M.Icon>search</M.Icon>
        </M.InputAdornment>
      }
      endAdornment={
        focused && onHelpOpen ? (
          <M.InputAdornment position="end">
            <M.IconButton onClick={onHelpOpen}>
              <M.Icon>help_outline</M.Icon>
            </M.IconButton>
          </M.InputAdornment>
        ) : null
      }
      classes={classes}
      className={cx({
        [disabledCls]: disabled,
        [iconizedCls]: iconized,
        [hiddenCls]: hidden,
      })}
      placeholder={
        focused ? `Search ${bucket ? `s3://${bucket}` : 'all buckets'}` : 'Search'
      }
      disabled={disabled}
      {...props}
    />
  )
}

function SearchHelp({ opened, onClose }) {
  const ES_V = '6.7'
  const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Dialog open={opened} onClose={onClose}>
        <M.DialogTitle>Search Syntax</M.DialogTitle>
        <M.DialogContent>
          <M.Typography variant="body1" gutterBottom>
            Quilt uses ElasticSearch version 6.7 and supports “query_string” queries with
            the following syntax:
          </M.Typography>

          <M.Typography variant="body1" gutterBottom>
            Logical Operators: <code>AND</code>, <code>OR</code>.
          </M.Typography>

          <M.Typography variant="body1" gutterBottom>
            Wildcards: <code>*</code>, <code>?</code>.
          </M.Typography>

          <M.Typography variant="body1" gutterBottom>
            Quoting fields
          </M.Typography>

          <M.Typography variant="body1">
            <StyledLink href={ES_REF}>Learn more with the ES docs</StyledLink>
          </M.Typography>
        </M.DialogContent>
        <M.DialogActions>
          <M.Button onClick={onClose}>Close</M.Button>
        </M.DialogActions>
      </M.Dialog>
    </M.MuiThemeProvider>
  )
}

function State({ query, makeUrl, children, onFocus, onBlur }) {
  const dispatch = redux.useDispatch()

  const [value, change] = React.useState(null)
  const [focused, setFocused] = React.useState(false)
  const [helpOpened, setHelpOpened] = React.useState(false)

  const onChange = React.useCallback((evt) => {
    change(evt.target.value)
  }, [])

  const onKeyDown = React.useCallback(
    (evt) => {
      // eslint-disable-next-line default-case
      switch (evt.key) {
        case 'Enter':
          /* suppress onSubmit (didn't actually find this to be a problem tho) */
          evt.preventDefault()
          if (query !== value) {
            dispatch(push(makeUrl(value)))
          }
          evt.target.blur()
          break
        case 'Escape':
          evt.target.blur()
          break
      }
    },
    [dispatch, makeUrl, value, query],
  )

  const handleFocus = React.useCallback(() => {
    change(query)
    setFocused(true)
    if (onFocus) onFocus()
  }, [query])

  const handleBlur = React.useCallback(() => {
    change(null)
    setTimeout(() => setFocused(false), 100) // Fire rest of events and only then blur
    if (onBlur) onBlur()
  }, [])

  const handleHelpOpen = React.useCallback(() => setHelpOpened(true), [])

  const handleHelpClose = React.useCallback(() => setHelpOpened(false), [])

  return children({
    value: value === null ? query : value,
    onChange,
    onKeyDown,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onHelpOpen: handleHelpOpen,
    onHelpClose: handleHelpClose,
    focused,
    helpOpened,
  })
}

function BucketSearch({ bucket, onFocus, onBlur, disabled, ...props }) {
  const cfg = BucketConfig.useCurrentBucketConfig()
  const { paths, urls } = NamedRoutes.use()
  const { location: l, match } = useRoute(paths.bucketSearch)
  const query = (match && parse(l.search).q) || ''
  const makeUrl = React.useCallback((q) => urls.bucketSearch(bucket, q), [urls, bucket])
  return cfg && !disabled ? (
    <State {...{ query, makeUrl, onFocus, onBlur }}>
      {(state) => <SearchBox {...{ bucket, ...state, ...props }} />}
    </State>
  ) : (
    <SearchBox disabled value="Search not available" {...props} />
  )
}

function GlobalSearch({ onFocus, onBlur, disabled, ...props }) {
  const cfg = Config.useConfig()
  const { paths, urls } = NamedRoutes.use()
  const { location: l, match } = useRoute(paths.search)
  const { q: query = '', buckets } = match ? parse(l.search) : {}
  const makeUrl = React.useCallback((q) => urls.search({ q, buckets }), [urls, buckets])
  if (cfg.disableNavigator) return null
  return disabled ? (
    <SearchBox disabled value="Search not available" {...props} />
  ) : (
    <State {...{ query, makeUrl, onFocus, onBlur }}>
      {(state) => (
        <>
          <SearchBox {...state} {...props} />
          <SearchHelp opened={state.helpOpened} onClose={state.onHelpClose} />
        </>
      )}
    </State>
  )
}

function DelayedProgress({
  TransitionComponent = M.Fade,
  ProgressComponent = M.CircularProgress,
  progressProps,
  transitionProps,
  ...props
}) {
  return (
    <Delay alwaysRender {...props}>
      {(ready) => (
        <TransitionComponent in={ready} {...transitionProps}>
          <ProgressComponent {...progressProps} />
        </TransitionComponent>
      )}
    </Delay>
  )
}

export default (props) => (
  <React.Suspense fallback={<DelayedProgress />}>
    {props.bucket ? <BucketSearch {...props} /> : <GlobalSearch {...props} />}
  </React.Suspense>
)
