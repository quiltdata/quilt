import * as R from 'ramda'
import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Pagination from 'components/Pagination2'
import * as BucketConfig from 'utils/BucketConfig'
import * as NamedRoutes from 'utils/NamedRoutes'
import scrollIntoView from 'utils/scrollIntoView'
import useDebouncedInput from 'utils/useDebouncedInput'
import usePrevious from 'utils/usePrevious'

import BucketGrid from 'website/components/BucketGrid'

const PER_PAGE = 9

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingBottom: t.spacing(5),
    paddingTop: t.spacing(10),
    position: 'relative',
  },
  filter: {
    marginBottom: t.spacing(5),
    marginTop: 0,
    [t.breakpoints.up('sm')]: {
      maxWidth: 360,
    },
  },
  pgBtn: {
    background: fade(t.palette.secondary.main, 0),
    border: `1px solid ${t.palette.secondary.main}`,
    color: t.palette.secondary.main,
    '&:hover': {
      background: fade(t.palette.secondary.main, t.palette.action.hoverOpacity),
    },
    '&:not(:last-child)': {
      borderRight: 'none',
    },
  },
  pgCurrent: {
    color: t.palette.text.primary,
    background: t.palette.secondary.main,
    '&:hover': {
      background: t.palette.secondary.main,
    },
  },
}))

export default function Buckets({ query: filter } = { query: '' }) {
  const classes = useStyles()
  const buckets = BucketConfig.useRelevantBucketConfigs()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const [page, setPage] = React.useState(1)
  const scrollRef = React.useRef(null)

  const terms = React.useMemo(() => filter.toLowerCase().split(/\s+/).filter(Boolean), [
    filter,
  ])

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

  return (
    <M.Container
      maxWidth="lg"
      className={classes.root}
      id="buckets"
      ref={scrollIntoView()}
    >
      <div ref={scrollRef} style={{ position: 'relative', top: -72 }} />
      <M.TextField
        className={classes.filter}
        placeholder="Find a bucket"
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
      {paginated.length ? (
        <BucketGrid
          buckets={paginated}
          onTagClick={filtering.set}
          tagIsMatching={tagIsMatching}
        />
      ) : (
        <M.Typography color="textPrimary" variant="h4">
          No buckets mathcing <b>&quot;{filter}&quot;</b>
        </M.Typography>
      )}
      {pages > 1 && (
        <Pagination
          {...{ pages, page, onChange: setPage }}
          mt={4}
          mb={0}
          classes={{ button: classes.pgBtn, current: classes.pgCurrent }}
        />
      )}
    </M.Container>
  )
}
