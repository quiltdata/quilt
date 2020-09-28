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
import searchQuerySyntax from 'translations/search-query-syntax.json'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: fade(t.palette.common.white, 0),
    borderRadius: t.shape.borderRadius,
    overflow: 'hidden',
    padding: `0 ${t.spacing(1)}px 0 ${t.spacing(1.5)}px`,
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
  expanded: {
    background: `${fade(t.palette.common.white, 0.2)} !important`,
    width: '100%',
  },
  hidden: {
    opacity: 0,
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
}))

const useSuggestStyles = M.makeStyles((t) => ({
  root: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: t.spacing(4),
  },
  row: {
    cursor: 'pointer',
  },
  definition: {
    width: '300px',
  },
  group: {
    marginTop: t.spacing(2),
  },
  wrapper: {
    right: t.spacing(3),
  },
}))

function SearchBox({
  bucket,
  disabled,
  iconized,
  hidden,
  expanded,
  onHelpOpen,
  onCollapse,
  onQuery,
  inputEl,
  ...props
}) {
  const {
    disabled: disabledCls,
    expanded: expandedCls,
    hidden: hiddenCls,
    iconized: iconizedCls,
    ...classes
  } = useStyles()
  return (
    <M.InputBase
      startAdornment={
        <>
          {expanded ? (
            <M.InputAdornment>
              <M.Button size="small" onClick={onHelpOpen}>
                Advanced
                <M.Icon>keyboard_arrow_down</M.Icon>
              </M.Button>
            </M.InputAdornment>
          ) : (
            <M.InputAdornment>
              <M.Icon>search</M.Icon>
            </M.InputAdornment>
          )}
        </>
      }
      endAdornment={
        expanded ? (
          <M.InputAdornment position="end">
            <M.IconButton size="small" onClick={onCollapse}>
              <M.Icon>close</M.Icon>
            </M.IconButton>
          </M.InputAdornment>
        ) : null
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

function SearchSuggest({ inputEl, opened, onQuery }) {
  const { definition, group, root, row, wrapper } = useSuggestStyles()

  const ES_V = '6.7'
  const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

  const {
    caption,
    keywords,
    operators,
    title: suggestTitle,
    wildcards,
  } = searchQuerySyntax
  const syntaxHelpRows = [wildcards, operators, keywords]

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Popper
        anchorEl={inputEl}
        disablePortal
        open={opened}
        placement="bottom-start"
        className={cx(wrapper)}
      >
        <M.Paper className={cx(root)}>
          <M.Grid container direction="row" justify="space-between" alignItems="center">
            <M.Grid item>
              <M.Typography variant="subtitle1">{suggestTitle}</M.Typography>
            </M.Grid>
            <M.Grid item>
              <M.Typography variant="caption">
                {caption}
                <StyledLink href={ES_REF}>ES 6.7</StyledLink>
              </M.Typography>
            </M.Grid>
          </M.Grid>

          {syntaxHelpRows.map((syntaxHelp) => (
            <M.TableContainer className={cx(group)} key={syntaxHelp.title}>
              <M.Typography variant="subtitle2">{syntaxHelp.title}</M.Typography>
              <M.Table size="small">
                <M.TableBody>
                  {syntaxHelp.rows.map(({ key, title }) => (
                    <M.TableRow
                      className={cx(row)}
                      key={key}
                      onClick={() => onQuery(key)}
                      hover
                    >
                      <M.TableCell className={cx(definition)} component="th">
                        {key}
                      </M.TableCell>
                      <M.TableCell>{title}</M.TableCell>
                    </M.TableRow>
                  ))}
                </M.TableBody>
              </M.Table>
            </M.TableContainer>
          ))}
        </M.Paper>
      </M.Popper>
    </M.MuiThemeProvider>
  )
}

function State({ query, makeUrl, children, onFocus, onBlur }) {
  const dispatch = redux.useDispatch()

  const [value, change] = React.useState(null)
  const [expanded, setExpanded] = React.useState(false)
  const [inputEl, setInputEl] = React.useState(null)

  const onChange = React.useCallback((evt) => {
    change(evt.target.value)
  }, [])

  const handleFocus = React.useCallback(() => {
    setInputEl(null)

    if (expanded) {
      return
    }

    change(query)
    setExpanded(true)
    if (onFocus) onFocus()
  }, [query, value])

  const handleCollapse = React.useCallback(() => {
    change(null)
    setExpanded(false)
    setInputEl(null)
    if (onBlur) onBlur()
  })

  const handleHelpOpen = React.useCallback(
    ({ currentTarget }) => setInputEl(currentTarget),
    [],
  )

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
        // TODO
        // case 'ArrowDown':
        //   handleHelpOpen(evt)
        //   break
      }
    },
    [dispatch, makeUrl, value, query],
  )

  const handleQuery = React.useCallback(
    (strPart) => {
      change(`${value} ${strPart}`)
    },
    [value],
  )

  return children({
    value: value === null ? query : value,
    onChange,
    onKeyDown,
    onFocus: handleFocus,
    onHelpOpen: handleHelpOpen,
    onCollapse: handleCollapse,
    onQuery: handleQuery,
    expanded,
    inputEl,
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
          <SearchSuggest
            inputEl={state.inputEl}
            opened={Boolean(state.inputEl)}
            onQuery={state.onQuery}
          />
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
