import * as R from 'ramda'
import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as BucketConfig from 'utils/BucketConfig'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'
import useEditableValue from 'utils/useEditableValue'

function Results({ buckets, mode, query, page, scrollRef, makePageUrl }) {
  const req = AWS.APIGateway.use()
  const data = Data.use(search, { req, buckets, mode, query })
  return data.case({
    _: () => (
      <SearchResults.Progress>
        Searching {displaySelectedBuckets(buckets)} for &quot;{query}&quot;
      </SearchResults.Progress>
    ),
    Err: SearchResults.handleErr(data.fetch),
    Ok: ({ total, hits }) =>
      total ? (
        <SearchResults.Hits {...{ hits, page, scrollRef, makePageUrl }} showBucket />
      ) : (
        <SearchResults.NothingFound />
      ),
  })
}

const displaySelectedBuckets = (buckets) => {
  if (!buckets.length) return 'all buckets'
  if (buckets.length === 1) return `s3://${buckets[0]}`
  return `${buckets.length} buckets`
}

const useQueryInputStyles = M.makeStyles((t) => ({
  searchIcon: {
    left: 8,
    pointerEvents: 'none',
    position: 'absolute',
  },
  input: {
    paddingLeft: t.spacing(5),
    paddingRight: t.spacing(1),
    paddingBottom: 11,
    paddingTop: 10,
    [t.breakpoints.down('xs')]: {
      paddingBottom: 15,
      paddingTop: 14,
    },
  },
}))

function QueryInput({ query, buckets, onChange }) {
  const classes = useQueryInputStyles()
  const state = useEditableValue(query, onChange)

  const handleChange = React.useCallback(
    (e) => {
      state.change(e.target.value)
    },
    [state.change],
  )

  const handleKeyDown = React.useCallback(
    (e) => {
      // eslint-disable-next-line default-case
      switch (e.key) {
        case 'Enter':
          // suppress onSubmit (didn't actually find this to be a problem tho)
          e.preventDefault()
          state.commit()
          e.target.blur()
          break
        case 'Escape':
          e.target.blur()
          break
      }
    },
    [state.commit],
  )

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const placeholder = xs ? `Search ${displaySelectedBuckets(buckets)}` : 'Search'

  return (
    <M.InputBase
      value={state.value}
      onFocus={state.edit}
      onBlur={state.cancel}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      classes={{ input: classes.input }}
      fullWidth
      startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
    />
  )
}

const useBucketSelectDropdownStyles = M.makeStyles((t) => ({
  btn: {
    MozAppearance: 'none',
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    outline: 0,
    border: 0,
    margin: 0,
    borderRadius: 0,
    padding: 0,
    userSelect: 'none',

    ...t.typography.body1,
    cursor: 'pointer',
    fontWeight: t.typography.fontWeightMedium,
  },
}))

function BucketSelectDropdown({ buckets, onChange, short = false }) {
  const classes = useBucketSelectDropdownStyles()
  const state = useEditableValue(buckets, onChange)

  const options = BucketConfig.useRelevantBucketConfigs()

  const anchorRef = React.useRef(null)

  const handleSelect = (v) => () => {
    state.change(
      R.ifElse(
        R.includes(v),
        R.without([v]),
        R.pipe(R.append(v), R.sortBy(R.identity)),
      )(state.value),
    )
  }

  const selectAll = React.useCallback(() => {
    state.commitValue([])
  }, [state.commitValue])

  return (
    <>
      <button type="button" onClick={state.edit} className={classes.btn} ref={anchorRef}>
        <span>
          {short ? <>{'s3://'}&hellip;</> : displaySelectedBuckets(state.value)}
        </span>
        <M.Icon fontSize="inherit">expand_more</M.Icon>
      </button>
      <M.Menu
        anchorEl={anchorRef.current}
        open={state.edited}
        onClose={state.commit}
        MenuListProps={{ dense: true }}
      >
        <M.MenuItem disabled>
          <M.ListItemText primary="Select buckets to search" />
        </M.MenuItem>
        <M.MenuItem selected={!state.value.length} onClick={selectAll}>
          <M.ListItemIcon>
            <M.Checkbox checked={!state.value.length} edge="start" />
          </M.ListItemIcon>
          <M.ListItemText primary="All buckets" />
        </M.MenuItem>
        {options.map((o) => (
          <M.MenuItem
            key={o.name}
            onClick={handleSelect(o.name)}
            selected={state.value.includes(o.name)}
          >
            <M.ListItemIcon>
              <M.Checkbox checked={state.value.includes(o.name)} edge="start" />
            </M.ListItemIcon>
            <M.ListItemText primary={o.title} secondary={`s3://${o.name}`} />
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}

const displayMode = (m) => {
  if (m === 'packages') return 'packages'
  if (m === 'objects') return 'objects'
  return 'objects & packages'
}

function ModeSelectDropdown({ mode, onChange }) {
  const classes = useBucketSelectDropdownStyles()
  const options = [undefined, 'objects', 'packages']

  const [edited, setEdited] = React.useState(false)

  const edit = React.useCallback(() => setEdited(true), [setEdited])
  const close = React.useCallback(() => setEdited(false), [setEdited])

  const anchorRef = React.useRef(null)

  const handleSelect = (v) => () => {
    onChange(v)
    close()
  }

  return (
    <>
      <button type="button" onClick={edit} className={classes.btn} ref={anchorRef}>
        {displayMode(mode)}
        <M.Icon fontSize="inherit">expand_more</M.Icon>
      </button>
      <M.Menu
        anchorEl={anchorRef.current}
        open={edited}
        onClose={close}
        MenuListProps={{ dense: true }}
      >
        {options.map((o) => (
          <M.MenuItem key={o || 'all'} onClick={handleSelect(o)} selected={mode === o}>
            <M.ListItemText primary={displayMode(o)} />
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}

const useModeAndBucketSelectorStyles = M.makeStyles((t) => ({
  overlay: {
    background: t.palette.common.white,
    bottom: 0,
    display: 'flex',
    justifyContent: 'space-between',
    left: 44,
    paddingRight: 4,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  controls: {
    lineHeight: '48px',
  },
}))

function ModeAndBucketSelector({ mode, onModeChange, buckets, onBucketsChange }) {
  const classes = useModeAndBucketSelectorStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const [controlsShown, setControlsShown] = React.useState(false)
  const showControls = React.useCallback(() => setControlsShown(true), [setControlsShown])
  const hideControls = React.useCallback(() => setControlsShown(false), [
    setControlsShown,
  ])

  const controls = (
    <>
      {!xs && <M.Typography component="span">Searching </M.Typography>}
      <ModeSelectDropdown mode={mode} onChange={onModeChange} />
      <M.Typography component="span"> in </M.Typography>
      <BucketSelectDropdown buckets={buckets} onChange={onBucketsChange} short={xs} />
    </>
  )

  return xs ? (
    <>
      <M.IconButton onClick={showControls}>
        <M.Icon>menu</M.Icon>
      </M.IconButton>
      {controlsShown && (
        <div className={classes.overlay}>
          <div className={classes.controls}>{controls}</div>
          <M.IconButton onClick={hideControls}>
            <M.Icon>done</M.Icon>
          </M.IconButton>
        </div>
      )}
    </>
  ) : (
    controls
  )
}

const useSearchStyles = M.makeStyles((t) => ({
  paper: {
    paddingLeft: t.spacing(1.5),
    paddingRight: t.spacing(1),
    lineHeight: '40px',

    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
      boxShadow: 'none',
      '&:first-child': {
        paddingLeft: t.spacing(0.5),
      },
      '&:last-child': {
        paddingRight: t.spacing(0.5),
      },
    },
  },
}))

export default function Search({ location: l }) {
  const classes = useSearchStyles()

  const params = parseSearch(l.search)
  const { q, p, mode } = params
  const buckets = params.buckets ? params.buckets.split(',').sort() : []
  const page = p && parseInt(p, 10)

  const scrollRef = React.useRef(null)

  const { urls } = NamedRoutes.use()
  const history = useHistory()

  const handleQueryChange = React.useCallback(
    (newQuery) => {
      history.push(
        urls.search({ q: newQuery, buckets: buckets.join(',') || undefined, mode }),
      )
    },
    [history, urls, buckets, mode],
  )

  const handleBucketsChange = React.useCallback(
    (newBuckets) => {
      history.push(urls.search({ q, buckets: newBuckets.join(',') || undefined, mode }))
    },
    [history, urls, q, mode],
  )

  const handleModeChange = React.useCallback(
    (newMode) => {
      history.push(
        urls.search({ q, buckets: buckets.join(',') || undefined, mode: newMode }),
      )
    },
    [history, urls, buckets, q],
  )

  const makePageUrl = React.useCallback(
    (newP) =>
      urls.search({
        q,
        buckets: buckets.join(',') || undefined,
        p: newP !== 1 ? newP : undefined,
        mode,
      }),
    [urls, q, buckets, mode],
  )

  return (
    <Layout
      pre={
        <M.Container maxWidth="lg">
          <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
            <M.Box
              display="flex"
              position="relative"
              mt={{ xs: 0, sm: 3 }}
              ref={scrollRef}
            >
              <M.Box
                component={M.Paper}
                className={classes.paper}
                flexGrow={{ xs: 1, sm: 0 }}
                position="relative"
              >
                <QueryInput
                  query={q || ''}
                  buckets={buckets}
                  onChange={handleQueryChange}
                />
              </M.Box>
              <M.Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />
              <M.Box component={M.Paper} className={classes.paper}>
                <ModeAndBucketSelector
                  mode={mode}
                  onModeChange={handleModeChange}
                  buckets={buckets}
                  onBucketsChange={handleBucketsChange}
                />
              </M.Box>
            </M.Box>
            {q ? (
              <Results {...{ query: q, buckets, page, mode, scrollRef, makePageUrl }} />
            ) : (
              // TODO: revise copy
              <SearchResults.Alt>
                <M.Typography variant="body1">Search for anything</M.Typography>
              </SearchResults.Alt>
            )}
          </M.Box>
        </M.Container>
      }
    />
  )
}
