import cx from 'classnames'
import { push } from 'connected-react-router/esm/immutable'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'
import * as Lab from '@material-ui/lab'

import * as style from 'constants/style'
import * as Config from 'utils/Config'
import * as BucketConfig from 'utils/BucketConfig'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'
import { useRoute } from 'utils/router'

import SearchHelp from './Help'

const expandAnimationDuration = 200

const useStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0),
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden',
    padding: `0 ${t.spacing(1)}px 0 0`,
    position: 'absolute',
    right: 0,
    transition: [
      `background-color ${expandAnimationDuration}ms`,
      `opacity ${expandAnimationDuration}ms`,
      `width ${expandAnimationDuration}ms`,
    ],
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
  help: {
    left: 0,
    maxHeight: '400px',
    overflowY: 'auto',
    position: 'absolute',
    right: 0,
    top: t.spacing(5),

    [t.breakpoints.down('xs')]: {
      left: '-43px',
      right: '-36px',
    },
  },
  hidden: {
    opacity: 0,
  },
  expanded: {
    background: `${fade(t.palette.common.white, 0.2)} !important`,
    width: '100%',
  },
  input: {
    paddingLeft: t.spacing(1),
    paddingTop: 8,
    paddingBottom: 9,
    textOverflow: 'ellipsis',
    transition: ['opacity 200ms'],
    '$iconized:not($expanded) &': {
      opacity: 0,
    },
  },
  inputIcon: {
    cursor: 'pointer',
  },
  inputOptions: {
    borderRadius: 0,
    borderWidth: '0 1px 0 0',
    paddingLeft: t.spacing(1.25),
    paddingRight: t.spacing(0.25),
  },
  wrapper: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
}))

function SearchBox({
  bucket,
  disabled,
  iconized,
  hidden,
  expanded,
  onHelpOpen,
  onHelpClose,
  onCollapse,
  onToggleOptions,
  onQuery,
  helpOpened,
  ...props
}) {
  const {
    disabled: disabledCls,
    expanded: expandedCls,
    help: helpCls,
    hidden: hiddenCls,
    iconized: iconizedCls,
    inputIcon: inputIconCls,
    inputOptions: inputOptionsCls,
    wrapper: wrapperCls,
    ...classes
  } = useStyles()

  const onClickAway = React.useCallback(() => {
    if (expanded || helpOpened) {
      onHelpClose()
    }
  }, [helpOpened, expanded, onHelpClose])

  return (
    <M.ClickAwayListener onClickAway={onClickAway}>
      <div className={wrapperCls}>
        <M.MuiThemeProvider theme={style.appTheme}>
          <M.Fade in={helpOpened}>
            <SearchHelp className={helpCls} onQuery={onQuery} />
          </M.Fade>
        </M.MuiThemeProvider>

        <M.InputBase
          startAdornment={
            <M.InputAdornment>
              {iconized && !expanded ? (
                <M.Icon className={inputIconCls} onClick={onToggleOptions}>
                  search
                </M.Icon>
              ) : (
                <Lab.ToggleButton
                  className={inputOptionsCls}
                  size="small"
                  value="help"
                  selected={helpOpened}
                  onChange={onToggleOptions}
                >
                  <M.Icon size="small">search</M.Icon>
                  <M.Icon size="small">
                    {helpOpened ? 'arrow_drop_up' : 'arrow_drop_down'}
                  </M.Icon>
                </Lab.ToggleButton>
              )}
            </M.InputAdornment>
          }
          classes={classes}
          className={cx({
            [expandedCls]: expanded,
            [disabledCls]: disabled,
            [iconizedCls]: iconized,
            [hiddenCls]: hidden,
          })}
          placeholder={
            expanded ? `Search ${bucket ? `s3://${bucket}` : 'all buckets'}` : 'Search'
          }
          disabled={disabled}
          {...props}
        />
      </div>
    </M.ClickAwayListener>
  )
}

function State({ query, makeUrl, children, onFocus, onBlur }) {
  const dispatch = redux.useDispatch()

  const [value, change] = React.useState(null)
  const [expanded, setExpanded] = React.useState(false)
  const [helpOpened, setHelpOpened] = React.useState(false)

  const onChange = React.useCallback((evt) => {
    change(evt.target.value)
  }, [])

  const handleExpand = React.useCallback(() => {
    if (expanded) {
      return
    }

    change(query)
    setExpanded(true)
    if (onFocus) onFocus()
  }, [expanded, query, onFocus])

  const handleCollapse = React.useCallback(() => {
    change(null)
    setExpanded(false)
    setHelpOpened(false)
    if (onBlur) onBlur()
  }, [onBlur])

  const handleHelpOpen = React.useCallback(() => setHelpOpened(true), [])

  const handleHelpClose = React.useCallback(() => setHelpOpened(false), [])

  const handleQuery = React.useCallback(
    (strPart) => {
      const normalized = strPart.replace(/\s/g, '')
      change(`${value} ${normalized}`)
    },
    [value],
  )

  const handleToggleOptions = React.useCallback(() => {
    if (helpOpened) {
      handleHelpClose()
      return
    }
    if (expanded) {
      handleHelpOpen()
    } else {
      handleExpand()
      const animationDelay = expandAnimationDuration + 100
      setTimeout(handleHelpOpen, animationDelay)
    }
  }, [expanded, helpOpened, handleExpand, handleHelpClose, handleHelpOpen])

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
          handleCollapse()
          evt.target.blur()
          break
        case 'Tab':
        case 'Escape':
          handleCollapse()
          evt.target.blur()
          break
        case 'ArrowDown':
          handleHelpOpen()
          break
      }
    },
    [dispatch, makeUrl, value, query, handleCollapse, handleHelpOpen],
  )

  return children({
    value: value === null ? query : value,
    onChange,
    onKeyDown,
    onFocus: handleExpand,
    onToggleOptions: handleToggleOptions,
    onHelpOpen: handleHelpOpen,
    onHelpClose: handleCollapse,
    onCollapse: handleCollapse,
    onQuery: handleQuery,
    expanded,
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
      {(state) => <SearchBox {...state} {...props} />}
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
