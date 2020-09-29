import cx from 'classnames'
import { push } from 'connected-react-router/esm/immutable'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import { fade } from '@material-ui/core/styles/colorManipulator'

import * as style from 'constants/style'
import * as Config from 'utils/Config'
import * as BucketConfig from 'utils/BucketConfig'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'
import { useRoute } from 'utils/router'
import StyledLink from 'utils/StyledLink'
import searchQuerySyntax from 'translations/search-query-syntax.json'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0),
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden',
    padding: `0 ${t.spacing(1)}px 0 0`,
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
    borderWidth: '0 1px 0 0',
    borderRadius: 0,
    padding: '5px 2px 5px 10px',
  },
}))

const useHelpStyles = M.makeStyles((t) => ({
  '@keyframes appear': {
    '0%': {
      transform: 'translateY(-10px)',
    },
    '100%': {
      transform: 'translateY(0)',
    },
  },
  root: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: `${t.spacing()}px ${t.spacing(4)}px ${t.spacing(4)}px`,
    [t.breakpoints.down('xs')]: {
      paddingLeft: t.spacing(),
      paddingRight: t.spacing(),
    },
  },
  caption: {
    marginTop: t.spacing(2),
    paddingBottom: t.spacing(2),
  },
  group: {
    marginTop: t.spacing(2),
  },
  wrapper: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: t.spacing(3),
    animation: '$appear 150ms ease',
    [t.breakpoints.down('xs')]: {
      left: '-50px',
      right: '-50px',
    },
  },
  headerLabel: {
    '&:hover': {
      background: 'transparent',
    },
  },
  itemRoot: {
    marginTop: t.spacing(),
    paddingBottom: t.spacing(),
    borderBottom: `1px solid ${t.palette.divider}`,
    '&:last-child': {
      border: 0,
    },
  },
  itemIcon: {
    width: 0,
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
    hidden: hiddenCls,
    iconized: iconizedCls,
    inputIcon: inputIconCls,
    inputOptions: inputOptionsCls,
    ...classes
  } = useStyles()
  return (
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
              <M.Icon size="small">tune</M.Icon>
              <M.Icon size="small">
                {helpOpened ? 'arrow_drop_up' : 'arrow_drop_down'}
              </M.Icon>
            </Lab.ToggleButton>
          )}
        </M.InputAdornment>
      }
      endAdornment={
        expanded && (
          <M.InputAdornment position="end">
            <M.IconButton size="small" onClick={onCollapse}>
              <M.Icon>close</M.Icon>
            </M.IconButton>
          </M.InputAdornment>
        )
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
  )
}

function SearchHelp({ onClose, onQuery }) {
  const classes = useHelpStyles()

  const ES_V = '6.7'
  const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

  const { caption, keywords, operators, wildcards } = searchQuerySyntax
  const syntaxHelpRows = [wildcards, operators, keywords]
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  return (
    <M.ClickAwayListener onClickAway={onClose}>
      <M.Box className={classes.wrapper}>
        <M.Paper className={classes.root}>
          <Lab.TreeView
            defaultCollapseIcon={<M.Icon>arrow_drop_down</M.Icon>}
            defaultExpandIcon={<M.Icon>arrow_right</M.Icon>}
            defaultExpanded={syntaxHelpRows.map((syntaxHelp) => syntaxHelp.title)}
            disableSelection
          >
            {syntaxHelpRows.map((syntaxHelp) => (
              <Lab.TreeItem
                className={classes.group}
                label={
                  <M.Typography variant="subtitle2">{syntaxHelp.title}</M.Typography>
                }
                nodeId={syntaxHelp.title}
                key={syntaxHelp.title}
                classes={{
                  label: classes.headerLabel,
                }}
              >
                {syntaxHelp.rows.map(({ key, title }) => (
                  <Lab.TreeItem
                    key={key}
                    nodeId={key}
                    classes={{
                      iconContainer: classes.itemIcon,
                      root: classes.itemRoot,
                    }}
                    onLabelClick={() => onQuery(key)}
                    label={
                      <M.Grid container>
                        <M.Grid item xs={xs ? 4 : 3}>
                          {key}
                        </M.Grid>
                        <M.Grid item xs>
                          {title}
                        </M.Grid>
                      </M.Grid>
                    }
                  />
                ))}
              </Lab.TreeItem>
            ))}
          </Lab.TreeView>

          <M.Box className={classes.caption}>
            <M.Typography variant="caption">
              {caption}
              <StyledLink href={ES_REF}>ES 6.7</StyledLink>
            </M.Typography>
          </M.Box>
        </M.Paper>
      </M.Box>
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
  }, [expanded, query])

  const handleCollapse = React.useCallback(() => {
    change(null)
    setExpanded(false)
    setHelpOpened(false)
    if (onBlur) onBlur()
  })

  const handleHelpOpen = React.useCallback(() => setHelpOpened(true), [])

  const handleHelpClose = React.useCallback(() => {
    setTimeout(() => setHelpOpened(false), 300) // FIXME: it's for mobile
  }, [])

  const handleQuery = React.useCallback(
    (strPart) => {
      change(`${value} ${strPart}`)
    },
    [value],
  )

  const handleToggleOptions = React.useCallback(() => {
    if (helpOpened) {
      handleHelpClose()
      return
    }
    if (!expanded) {
      handleExpand()
    }
    handleHelpOpen()
  }, [expanded, helpOpened])

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
          handleCollapse()
          evt.target.blur()
          break
        case 'ArrowDown':
          handleHelpOpen()
          break
      }
    },
    [dispatch, makeUrl, value, query],
  )

  return children({
    value: value === null ? query : value,
    onChange,
    onKeyDown,
    onFocus: handleExpand,
    onToggleOptions: handleToggleOptions,
    onHelpOpen: handleHelpOpen,
    onHelpClose: handleHelpClose,
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
      {(state) => (
        <>
          <SearchBox {...state} {...props} />
          {state.helpOpened ? (
            <M.MuiThemeProvider theme={style.appTheme}>
              <SearchHelp onQuery={state.onQuery} onClose={state.onHelpClose} />
            </M.MuiThemeProvider>
          ) : null}
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
