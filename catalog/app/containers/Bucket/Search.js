import * as R from 'ramda'
import * as React from 'react'
import { useHistory, Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Message from 'components/Message'
import Pagination from 'components/Pagination2'
import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as BucketConfig from 'utils/BucketConfig'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'
import useEditableValue from 'utils/useEditableValue'
import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10

function Alt({ ...props }) {
  return (
    <M.Box
      borderTop={{ xs: 1, sm: 0 }}
      borderColor="divider"
      pt={3}
      px={{ xs: 2, sm: 0 }}
      {...props}
    />
  )
}

function Browse({ bucket }) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Button component={Link} to={urls.bucketRoot(bucket)} variant="outlined">
      Browse the bucket
    </M.Button>
  )
}

function Hits({ hits, page, scrollRef, makePageUrl }) {
  const actualPage = page || 1
  const pages = Math.ceil(hits.length / PER_PAGE)

  const paginated = React.useMemo(
    () =>
      pages === 1 ? hits : hits.slice((actualPage - 1) * PER_PAGE, actualPage * PER_PAGE),
    [hits, actualPage],
  )

  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  return (
    <>
      {paginated.map((hit) => (
        <SearchResults.Hit key={hit.path} hit={hit} showBucket />
      ))}
      {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
    </>
  )
}

function Results({ bucket, query, page, mode, scrollRef, makePageUrl }) {
  const es = AWS.ES.use()
  const data = Data.use(search, { es, buckets: [bucket], mode, query })
  return data.case({
    _: () => (
      <Alt>
        <Delay alwaysRender>
          {(ready) => (
            <M.Fade in={ready}>
              <M.Box display="flex" alignItems="center">
                <M.Box pr={2}>
                  <M.CircularProgress size={24} />
                </M.Box>
                <M.Typography variant="body1">
                  Searching s3://{bucket} for &quot;{query}&quot;
                </M.Typography>
              </M.Box>
            </M.Fade>
          )}
        </Delay>
      </Alt>
    ),
    Err: R.cond([
      [
        R.propEq('message', 'TooManyRequests'),
        () => (
          <Alt>
            <Message headline="Too many requests">
              Processing a lot of requests. Please try your search again in a few minutes.
              <br />
              <br />
              <M.Button onClick={data.fetch} color="primary" variant="contained">
                Retry
              </M.Button>
            </Message>
          </Alt>
        ),
      ],
      [
        R.T,
        () => (
          <Alt>
            <Message headline="Server Error">
              Something went wrong.
              <br />
              <br />
              <M.Button onClick={data.fetch} color="primary" variant="contained">
                Retry
              </M.Button>
            </Message>
          </Alt>
        ),
      ],
    ]),
    Ok: ({ total, hits }) =>
      total ? (
        <Hits {...{ hits, page, scrollRef, makePageUrl }} />
      ) : (
        <Alt>
          <M.Typography variant="body1">
            We have not found anything matching your query
          </M.Typography>
          <br />
          <Browse bucket={bucket} />
        </Alt>
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
          <M.MenuItem key={o} onClick={handleSelect(o)} selected={mode === o}>
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

function Search({ bucket, query, page, mode }) {
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const classes = useSearchStyles()

  const scrollRef = React.useRef(null)

  const handleQueryChange = React.useCallback(
    (newQuery) => {
      history.push(urls.bucketSearch(bucket, newQuery, undefined, mode))
    },
    [history, urls, bucket, mode],
  )

  const handleModeChange = React.useCallback(
    (newMode) => {
      history.push(urls.bucketSearch(bucket, query, undefined, newMode))
    },
    [history, urls, bucket, query],
  )

  const makePageUrl = React.useCallback(
    (newP) => urls.bucketSearch(bucket, query, newP !== 1 ? newP : undefined, mode),
    [urls, bucket, query, mode],
  )

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
        <Results {...{ bucket, query, page, mode, scrollRef, makePageUrl }} />
      ) : (
        // TODO: revise copy
        <Alt>
          <M.Typography variant="body1">Search for anything</M.Typography>
        </Alt>
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
  const { q: query = '', p, mode } = parseSearch(l.search)
  const page = p && parseInt(p, 10)
  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      {cfg ? (
        <Search {...{ bucket, query, page, mode }} />
      ) : (
        <M.Typography variant="body1">Search unavailable</M.Typography>
      )}
    </M.Box>
  )
}
