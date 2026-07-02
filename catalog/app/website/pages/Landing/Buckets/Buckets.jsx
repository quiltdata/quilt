import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Pagination from 'components/Pagination2'
import cfg from 'constants/config'
import { useRelevantBuckets } from 'utils/Buckets'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

import Backlight from 'website/components/Backgrounds/Backlight1'
import BucketGrid from 'website/components/BucketGrid'

import IS_ADMIN_QUERY from '../gql/IsAdmin.generated'

const PER_PAGE = 24

function useIsAdmin() {
  const data = GQL.useQuery(IS_ADMIN_QUERY)
  return GQL.fold(data, {
    data: ({ me: { isAdmin } }) => isAdmin,
    fetching: R.F,
    error: R.F,
  })
}

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  container: {
    paddingBottom: t.spacing(5),
    paddingTop: t.spacing(3),
    position: 'relative',
    zIndex: 1,
  },
  title: {
    // Leave room for the absolutely-positioned theme toggle in the top-right
    // corner, and scale the display type down on small screens.
    paddingRight: t.spacing(6),
    [t.breakpoints.down('sm')]: {
      fontSize: '2.25rem',
      lineHeight: '2.75rem',
    },
    [t.breakpoints.down('xs')]: {
      fontSize: '1.75rem',
      lineHeight: '2.25rem',
    },
  },
  filter: {
    marginBottom: t.spacing(5),
    marginTop: 0,
    [t.breakpoints.up('sm')]: {
      maxWidth: 360,
    },
    // White filter field over the light wash, per the markup.
    '& .MuiOutlinedInput-root': {
      background: t.palette.type === 'dark' ? 'transparent' : t.palette.background.paper,
    },
  },
  backlight: {
    bottom: cfg.mode === 'PRODUCT' ? 0 : undefined,
    opacity: 0.5,
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    [t.breakpoints.down('xs')]: {
      alignItems: 'center',
      flexDirection: 'column-reverse',
      flexWrap: 'wrap',
    },
  },
  pgBtn: {
    background: fade(t.palette.primary.main, 0),
    border: `1px solid ${t.palette.primary.main}`,
    color: t.palette.primary.main,
    '&:hover': {
      background: fade(t.palette.primary.main, t.palette.action.hoverOpacity),
    },
    '&:not(:last-child)': {
      borderRight: 'none',
    },
  },
  pgCurrent: {
    color: t.palette.primary.contrastText,
    background: t.palette.primary.main,
    '&:hover': {
      background: t.palette.primary.main,
    },
  },
}))

export default function Buckets() {
  const classes = useStyles()
  const dark = M.useTheme().palette.type === 'dark'
  // XXX: consider using graphql directly
  const buckets = useRelevantBuckets()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const [page, setPage] = React.useState(1)
  const scrollRef = React.useRef(null)

  const location = useLocation()
  const { q: filter = '' } = parseSearch(location.search)
  const terms = React.useMemo(
    () => filter.toLowerCase().split(/\s+/).filter(Boolean),
    [filter],
  )

  const tagIsMatching = React.useCallback((t) => filter.includes(t), [filter])

  const filtered = React.useMemo(() => {
    if (!terms.length) return buckets
    const matches = R.allPass(R.map(R.includes, terms))
    return buckets.filter(
      R.pipe(
        (b) => [b.title, b.name, b.description, ...(b.tags || [])],
        R.filter(Boolean),
        R.map(R.toLower),
        R.any(matches),
      ),
    )
  }, [terms, buckets])

  const pages = Math.ceil(filtered.length / PER_PAGE)

  const paginated = React.useMemo(
    () =>
      pages === 1 ? filtered : filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, pages, page],
  )

  usePrevious(page, (prev) => {
    if (prev && page !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  })

  usePrevious(filtered, (prev) => {
    if (prev && !R.equals(filtered, prev)) {
      setPage(1)
    }
  })

  const filtering = useDebouncedInput(filter, 500)

  React.useEffect(() => {
    // TODO: handle route change
    //       and implement BucketGrid tag as <Link />
    if (filtering.value !== filter) {
      history.push(urls.home({ q: filtering.value }))
    }
  }, [history, filtering.value, filter, urls])

  const clearFilter = React.useCallback(() => {
    filtering.set()
  }, [filtering])

  const isAdmin = useIsAdmin()

  return (
    <div className={classes.root}>
      {dark && <Backlight className={classes.backlight} />}
      <M.Container maxWidth={false} className={classes.container}>
        <div ref={scrollRef} style={{ position: 'relative', top: -72 }} />
        <M.Typography variant="h1" color="textPrimary" className={classes.title}>
          Volumes
        </M.Typography>
        <M.Box mt={1} />
        <M.Typography color="textSecondary">
          Every volume is an S3 bucket today — versioned, governed, and searchable.
        </M.Typography>
        <M.Box mt={4} />
        <M.TextField
          className={classes.filter}
          placeholder="Find a volume"
          variant="outlined"
          margin="dense"
          fullWidth
          InputProps={{
            startAdornment: (
              <M.InputAdornment position="start">
                <M.Icon>search</M.Icon>
              </M.InputAdornment>
            ),
            endAdornment: filter ? (
              <M.InputAdornment position="end">
                <M.IconButton edge="end" onClick={clearFilter}>
                  <M.Icon>clear</M.Icon>
                </M.IconButton>
              </M.InputAdornment>
            ) : undefined,
          }}
          {...filtering.input}
        />
        {paginated.length || !filter ? (
          <BucketGrid
            buckets={paginated}
            onTagClick={filtering.set}
            tagIsMatching={tagIsMatching}
            showAddLink={!filter && buckets.length <= PER_PAGE - 1 && isAdmin}
          />
        ) : (
          <M.Typography color="textPrimary" variant="h4">
            No volumes matching <b>&quot;{filter}&quot;</b>
          </M.Typography>
        )}
        <div className={classes.controls}>
          <M.Box mt={2}>
            {buckets.length > 2 && isAdmin && (
              <M.Box mt={2} mr={2} display="inline-block">
                <M.Button
                  variant="contained"
                  color="primary"
                  component={Link}
                  to={urls.adminBuckets({ add: true })}
                >
                  Add volume
                </M.Button>
              </M.Box>
            )}
            <M.Box mt={2} display="inline-block">
              <M.Button
                variant="outlined"
                color="primary"
                href="https://open.quiltdata.com/"
              >
                Browse example buckets
              </M.Button>
            </M.Box>
          </M.Box>
          {pages > 1 && (
            <Pagination
              {...{ pages, page, onChange: setPage }}
              mt={4}
              mb={0}
              classes={{ button: classes.pgBtn, current: classes.pgCurrent }}
            />
          )}
        </div>
      </M.Container>
    </div>
  )
}
