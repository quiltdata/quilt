import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as urql from 'urql'

import Skeleton from 'components/Skeleton'
import * as APIConnector from 'utils/APIConnector'
import { useQuery } from 'utils/GraphQL'

type ScannerJob = {
  id: number
  name: string
  prefix: string
  ignore_dirs: boolean | null
  retries_remaining: number
  time_created: string
  next_key_marker?: string | null
  next_version_id_marker?: string | null
}

type BucketShardInfo = {
  name: string
  scannerParallelShardsDepth: number | null
}

const POLL_MS = 10_000

const CAVEATS_ID = 'indexing-caveats'

const BUCKET_SHARD_DEPTHS_QUERY = urql.gql`
  query {
    bucketConfigs {
      name
      scannerParallelShardsDepth
    }
  }
`

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
    position: 'relative',
    // The re-index dialog deep-links to #indexing, and the page scrolls under
    // Layout's sticky ContentBar (64px min-height), which would otherwise cover
    // this panel's heading on arrival. The unit is explicit because JSS's
    // default-unit plugin has no scroll-margin entry, so a bare number here
    // would emit an invalid declaration that the browser drops.
    scrollMarginTop: `${64 + t.spacing(2)}px`,
  },
  activity: {
    borderTopLeftRadius: 'inherit',
    borderTopRightRadius: 'inherit',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    // Motion is the only honest progress signal available: the registry stores
    // an opaque S3 resume cursor, never a denominator. An indeterminate strip
    // says "work is moving" without implying how much is left. Frozen it would
    // have to sit either empty or full, and a full bar claims the completion
    // this panel cannot know -- so drop it and let the label carry the state.
    '@media (prefers-reduced-motion: reduce)': {
      display: 'none',
    },
  },
  titleRow: {
    alignItems: 'baseline',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(0.5),
  },
  activeLabel: {
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1.5),
  },
  mono: {
    fontFamily: 'Roboto Mono, monospace',
    wordBreak: 'break-all',
  },
  numeric: {
    fontVariantNumeric: 'tabular-nums',
  },
  warning: {
    background: fade(t.palette.warning.main, 0.12),
    borderRadius: t.shape.borderRadius,
    color: t.palette.warning.dark,
    marginBottom: t.spacing(1.5),
    padding: t.spacing(1, 1.5),
  },
  caveat: {
    color: t.palette.text.secondary,
    maxWidth: '75ch',
  },
  caveatBlock: {
    marginBottom: t.spacing(1.5),
  },
  disclosure: {
    marginLeft: t.spacing(-1),
  },
  empty: {
    color: t.palette.text.secondary,
    maxWidth: '75ch',
  },
  exhausted: {
    opacity: 0.7,
  },
}))

function scopeLabel(job: ScannerJob): string {
  if (!job.prefix) {
    return job.ignore_dirs ? 'top-level keys only' : 'whole bucket'
  }
  return `prefix ${job.prefix}`
}

function useBulkScannerJobs(pollMs: number) {
  const req = APIConnector.use()
  const [jobs, setJobs] = React.useState<ScannerJob[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const seqRef = React.useRef(0)

  const load = React.useCallback(async () => {
    const seq = ++seqRef.current
    try {
      // APIConnector base is `${registryUrl}/api`, so endpoint is relative to /api.
      const data = (await req({
        endpoint: '/bulk_scanner_jobs',
        method: 'GET',
      })) as { results?: ScannerJob[] }
      // Discard superseded responses (overlapping polls / rapid Refresh).
      if (seq !== seqRef.current) return
      setJobs(data.results ?? [])
      setError(null)
    } catch (e) {
      if (seq !== seqRef.current) return
      // eslint-disable-next-line no-console
      console.error(e)
      setError('Could not load scanner jobs')
    }
  }, [req])

  React.useEffect(() => {
    load()
    const id = window.setInterval(load, pollMs)
    return () => window.clearInterval(id)
  }, [load, pollMs])

  return { jobs, error, reload: load }
}

function useBucketShardDepths() {
  const result = useQuery<{ bucketConfigs: BucketShardInfo[] }>(BUCKET_SHARD_DEPTHS_QUERY)

  return React.useMemo(() => {
    const next: Record<string, number | null> = {}
    for (const b of result.data?.bucketConfigs ?? []) {
      next[b.name] = b.scannerParallelShardsDepth
    }
    return next
  }, [result.data])
}

function LoadingRows() {
  return (
    <M.Box py={1}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={32} mt={i ? 1 : 0} borderRadius="borderRadius" />
      ))}
    </M.Box>
  )
}

export default function Indexing() {
  const classes = useStyles()
  const { jobs, error, reload } = useBulkScannerJobs(POLL_MS)
  const shardDepths = useBucketShardDepths()
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const emptySearchBuckets = React.useMemo(() => {
    if (!jobs) return []
    const names = new Set<string>()
    for (const job of jobs) {
      // Full-bucket wipe only: empty prefix and not a top-level-only (ignore_dirs) job.
      if (job.prefix !== '' || job.ignore_dirs) continue
      // Skip until shard config for this bucket is known — unknown must not warn.
      if (!Object.prototype.hasOwnProperty.call(shardDepths, job.name)) continue
      const depth = shardDepths[job.name]
      // Only warn where grounding is honest: unsharded buckets.
      if (depth == null || depth === 0) {
        names.add(job.name)
      }
    }
    return [...names].sort()
  }, [jobs, shardDepths])

  // `retries_remaining > 0` means "not exhausted", which is the most the payload
  // supports: there is no checked-out or worker field, so a queued job and a job
  // a worker is actively scanning are indistinguishable here. The copy says
  // "queued" for that reason -- claiming "in flight" would assert a running
  // worker this endpoint never reports.
  const outstanding = jobs?.filter((j) => j.retries_remaining > 0).length ?? 0
  const loading = jobs === null && !error
  // A failed poll leaves `jobs` at its last good value. Animating that would
  // assert liveness from data that is minutes stale, so the strip and its label
  // both stand down until a fetch succeeds again.
  const showActivity = outstanding > 0 && !error

  return (
    <M.Paper variant="outlined" className={classes.root} id="indexing">
      {showActivity && (
        <M.LinearProgress className={classes.activity} aria-hidden="true" />
      )}

      <div className={classes.titleRow}>
        <M.Typography variant="h5">Indexing</M.Typography>
        <M.Button size="small" onClick={reload} disabled={loading}>
          Refresh
        </M.Button>
      </div>

      {jobs && !error && (
        <M.Typography variant="body2" className={classes.activeLabel}>
          {outstanding > 0
            ? `${outstanding} ${outstanding === 1 ? 'job' : 'jobs'} queued, no completion estimate`
            : 'No jobs outstanding'}
        </M.Typography>
      )}

      <div className={classes.caveatBlock}>
        <M.Typography variant="body2" className={classes.caveat}>
          Position is the S3 list resume cursor, not a percentage — watch it change across
          refreshes to tell a progressing scan from a stalled one.
        </M.Typography>
        <M.Button
          className={classes.disclosure}
          size="small"
          onClick={() => setDetailsOpen((o) => !o)}
          aria-expanded={detailsOpen}
          aria-controls={CAVEATS_ID}
        >
          {detailsOpen ? 'Hide details' : 'Why no percentage or ETA?'}
        </M.Button>
        <M.Collapse in={detailsOpen}>
          <M.Typography id={CAVEATS_ID} variant="body2" className={classes.caveat}>
            Job age is time since creation; a healthy large scan yields after about
            20&nbsp;000 keys and is checked out again with the same creation time, so age
            alone cannot tell progressing from stalled. ETA is unknown because completed
            jobs are deleted. Queue order is newest-first, not FIFO. This panel does not
            report search-cluster health.
          </M.Typography>
        </M.Collapse>
      </div>

      {emptySearchBuckets.length > 0 && (
        <div className={classes.warning}>
          <M.Typography variant="body2" color="inherit">
            Full-bucket re-index in progress for{' '}
            <span className={classes.mono}>{emptySearchBuckets.join(', ')}</span>. Search
            for {emptySearchBuckets.length === 1 ? 'that bucket' : 'those buckets'}{' '}
            returns nothing until the rescan finishes.
          </M.Typography>
        </div>
      )}

      {error && (
        <M.Typography color="error" gutterBottom>
          {error} — retry with Refresh.
        </M.Typography>
      )}

      {loading && <LoadingRows />}

      {jobs && jobs.length === 0 && (
        <M.Typography className={classes.empty}>
          No scanner jobs queued. Start one from a bucket&apos;s Re-index action under
          Admin&nbsp;→&nbsp;Buckets.
        </M.Typography>
      )}

      {jobs && jobs.length > 0 && (
        <M.Table size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell>Bucket</M.TableCell>
              <M.TableCell>Scope</M.TableCell>
              <M.TableCell>Position</M.TableCell>
              <M.TableCell>Age</M.TableCell>
              <M.TableCell align="right">Attempts left</M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {jobs.map((job) => {
              const exhausted = job.retries_remaining <= 0
              const created = new Date(job.time_created)
              const cursor = job.next_key_marker
                ? job.next_key_marker
                : exhausted
                  ? '—'
                  : 'start'
              return (
                <M.TableRow
                  key={job.id}
                  className={exhausted ? classes.exhausted : undefined}
                >
                  <M.TableCell className={classes.mono}>{job.name}</M.TableCell>
                  <M.TableCell>{scopeLabel(job)}</M.TableCell>
                  {/* The cursor wraps rather than truncating: it is the one value
                      on this panel an admin compares across refreshes, and a
                      tooltip would be the only copy of it -- unreachable without
                      a pointer. */}
                  <M.TableCell className={classes.mono}>{cursor}</M.TableCell>
                  <M.TableCell>
                    {dateFns.formatDistanceToNow(created, { addSuffix: true })}
                    {exhausted && ' · exhausted'}
                  </M.TableCell>
                  <M.TableCell align="right" className={classes.numeric}>
                    {job.retries_remaining}
                  </M.TableCell>
                </M.TableRow>
              )
            })}
          </M.TableBody>
        </M.Table>
      )}
    </M.Paper>
  )
}
