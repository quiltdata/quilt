import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Pagination from 'components/Pagination2'
import * as BucketConfig from 'utils/BucketConfig'
import * as NamedRoutes from 'utils/NamedRoutes'
import scrollIntoView from 'utils/scrollIntoView'
import usePrevious from 'utils/usePrevious'

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
  grid: {
    display: 'grid',
    gridColumnGap: t.spacing(4),
    gridRowGap: t.spacing(4),
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto auto auto',
    [t.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'repeat(5, auto)',
    },
    [t.breakpoints.down('xs')]: {
      gridTemplateColumns: 'auto',
      gridTemplateRows: 'repeat(9, auto)',
    },
  },
  bucket: {
    background: 'linear-gradient(to top, #1f2151, #2f306e)',
    borderRadius: t.spacing(2),
    boxShadow: [[0, 16, 40, 'rgba(0, 0, 0, 0.2)']],
    display: 'flex',
    flexDirection: 'column',
    padding: t.spacing(4),
  },
  bucketTitle: {
    ...t.typography.h6,
    color: t.palette.tertiary.main,
  },
  bucketName: {
    ...t.typography.body1,
    color: t.palette.text.hint,
    lineHeight: t.typography.pxToRem(24),
  },
  bucketDesc: {
    ...t.typography.body2,
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    color: t.palette.text.secondary,
    display: '-webkit-box',
    lineHeight: t.typography.pxToRem(24),
    marginBottom: t.spacing(4),
    marginTop: t.spacing(3),
    maxHeight: t.typography.pxToRem(24 * 3),
    overflow: 'hidden',
    overflowWrap: 'break-word',
    textOverflow: 'ellipsis',
  },
  bucketTags: {
    marginRight: t.spacing(-1),
  },
  bucketTag: {
    ...t.typography.body2,
    background: fade(t.palette.secondary.main, 0.3),
    border: 'none',
    borderRadius: 2,
    color: t.palette.text.primary,
    cursor: 'pointer',
    display: 'inline-block',
    lineHeight: t.typography.pxToRem(28),
    marginRight: t.spacing(1),
    marginTop: t.spacing(1),
    outline: 'none',
    paddingBottom: 0,
    paddingLeft: t.spacing(1),
    paddingRight: t.spacing(1),
    paddingTop: 0,
  },
  bucketTagMatching: {
    background: t.palette.secondary.main,
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

export default function Buckets() {
  const classes = useStyles()
  const buckets = BucketConfig.useRelevantBucketConfigs()
  const { urls } = NamedRoutes.use()
  const [filter, setFilter] = React.useState('')
  const [page, setPage] = React.useState(1)
  const scrollRef = React.useRef(null)

  const terms = React.useMemo(() => filter.split(/\s+/).filter(Boolean), [filter])

  const filtered = React.useMemo(() => {
    if (!terms.length) return buckets
    const matches = R.anyPass(R.map(R.includes, terms))
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
    [filtered, page],
  )

  usePrevious(page, (prev) => {
    if (prev && page !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  usePrevious(filtered, (prev) => {
    if (prev && !R.equals(filtered, prev)) {
      setPage(1)
    }
  })

  const handleFilterChange = React.useCallback((e) => setFilter(e.target.value), [])

  const clearFilter = React.useCallback(() => setFilter(''), [])

  return (
    <M.Container
      maxWidth="lg"
      className={classes.root}
      id="buckets"
      ref={scrollIntoView()}
    >
      <M.TextField
        className={classes.filter}
        value={filter}
        onChange={handleFilterChange}
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
          ) : (
            undefined
          ),
        }}
      />
      <div ref={scrollRef} />
      {paginated.length ? (
        <div className={classes.grid}>
          {paginated.map((b) => (
            <div key={b.name} className={classes.bucket}>
              <Link className={classes.bucketTitle} to={urls.bucketRoot(b.name)}>
                {b.title}
              </Link>
              <Link className={classes.bucketName} to={urls.bucketRoot(b.name)}>
                s3://{b.name}
              </Link>
              {!!b.description && <p className={classes.bucketDesc}>{b.description}</p>}
              <M.Box flexGrow={1} />
              {!!b.tags && !!b.tags.length && (
                <div className={classes.bucketTags}>
                  {b.tags.map((t) => (
                    <button
                      key={t}
                      className={cx(
                        classes.bucketTag,
                        filter.includes(t) && classes.bucketTagMatching,
                      )}
                      type="button"
                      onClick={() => setFilter(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
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
