import * as React from 'react'
import { useHistory, Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as BucketConfig from 'utils/BucketConfig'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'
import useEditableValue from 'utils/useEditableValue'

function Browse({ bucket }) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Button component={Link} to={urls.bucketRoot(bucket)} variant="outlined">
      Browse the bucket
    </M.Button>
  )
}

function Results({ bucket, query, page, mode, scrollRef, makePageUrl, retry, retryUrl }) {
  const req = AWS.APIGateway.use()
  const data = Data.use(search, { req, buckets: [bucket], mode, query, retry })
  return data.case({
    _: () => (
      // TODO: display scope instead of bucket when implemented
      <SearchResults.Progress>
        Searching s3://{bucket} for &quot;{query}&quot;
      </SearchResults.Progress>
    ),
    Err: SearchResults.handleErr(retryUrl),
    Ok: ({ total, hits }) =>
      total ? (
        <SearchResults.Hits {...{ hits, page, scrollRef, makePageUrl }} showBucket />
      ) : (
        <SearchResults.NothingFound>
          <br />
          <Browse bucket={bucket} />
        </SearchResults.NothingFound>
      ),
  })
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

function QueryInput({ query, bucket, onChange }) {
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

  return (
    <M.InputBase
      value={state.value}
      onFocus={state.edit}
      onBlur={state.cancel}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={`Search s3://${bucket}`}
      classes={{ input: classes.input }}
      fullWidth
      startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
    />
  )
}

const displayMode = (m) => {
  if (m === 'packages') return 'packages'
  if (m === 'objects') return 'objects'
  return 'objects & packages'
}

const useModeSelectDropdownStyles = M.makeStyles((t) => ({
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

function ModeSelectDropdown({ mode, onChange }) {
  const classes = useModeSelectDropdownStyles()
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

const useModeSelectorStyles = M.makeStyles((t) => ({
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

function ModeSelector({ mode, onChange }) {
  const classes = useModeSelectorStyles()
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
      <ModeSelectDropdown mode={mode} onChange={onChange} />
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

function Search({ bucket, query, page, mode, retry }) {
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const classes = useSearchStyles()

  const scrollRef = React.useRef(null)

  const handleQueryChange = React.useCallback(
    (newQuery) => {
      history.push(urls.bucketSearch(bucket, { q: newQuery, mode }))
    },
    [history, urls, bucket, mode],
  )

  const handleModeChange = React.useCallback(
    (newMode) => {
      history.push(urls.bucketSearch(bucket, { q: query, mode: newMode }))
    },
    [history, urls, bucket, query],
  )

  const makePageUrl = React.useCallback(
    (newP) =>
      urls.bucketSearch(bucket, {
        q: query,
        p: newP !== 1 ? newP : undefined,
        mode,
        retry,
      }),
    [urls, bucket, query, mode, retry],
  )

  const retryUrl = urls.bucketSearch(bucket, { q: query, mode, retry: (retry || 0) + 1 })

  return (
    <>
      <M.Box display="flex" position="relative" mt={{ xs: 0, sm: 3 }} ref={scrollRef}>
        <M.Box
          component={M.Paper}
          className={classes.paper}
          flexGrow={{ xs: 1, sm: 0 }}
          position="relative"
        >
          <QueryInput query={query || ''} bucket={bucket} onChange={handleQueryChange} />
        </M.Box>
        <M.Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />
        <M.Box component={M.Paper} className={classes.paper}>
          <ModeSelector mode={mode} onChange={handleModeChange} />
        </M.Box>
      </M.Box>
      {query ? (
        <Results
          {...{ bucket, query, page, mode, scrollRef, makePageUrl, retry, retryUrl }}
        />
      ) : (
        // TODO: revise copy
        <SearchResults.Alt>
          <M.Typography variant="body1">Search for anything</M.Typography>
        </SearchResults.Alt>
      )}
    </>
  )
}

export default function BucketSearch({
  match: {
    params: { bucket },
  },
  location: l,
}) {
  const cfg = BucketConfig.useCurrentBucketConfig()
  const { q: query = '', p, mode, ...params } = parseSearch(l.search)
  const page = p && parseInt(p, 10)
  const retry = (params.retry && parseInt(params.retry, 10)) || undefined
  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      {cfg ? (
        <Search {...{ bucket, query, page, mode, retry }} />
      ) : (
        <M.Typography variant="body1">Search unavailable</M.Typography>
      )}
    </M.Box>
  )
}
