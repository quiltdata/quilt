import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Skeleton from 'components/Skeleton'
import * as APIConnector from 'utils/APIConnector'
import { useQuery } from 'utils/GraphQL'

import BUCKET_CONFIGS_QUERY from '../Buckets/gql/BucketConfigs.generated'

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

const POLL_MS = 10_000

// How long a cursor advance keeps counting as progress. Three polls, so a slow
// response that still lands inside the request deadline does not flip a working
// scan to "no movement".
const PROGRESS_TTL_MS = 3 * POLL_MS

// Two polls' worth of patience before a request is called dead. Long enough that
// a merely slow registry still answers, short enough that the panel stops
// claiming anything on the strength of a reading it can no longer refresh.
const REQUEST_TIMEOUT_MS = 2 * POLL_MS

const CAVEATS_ID = 'indexing-caveats'

// The fields whose absence would be read as a value rather than as missing data:
// a job with no `prefix` would otherwise pass for a whole-bucket wipe and raise
// a warning about an index nothing has emptied.
function isScannerJob(job: unknown): job is ScannerJob {
  if (typeof job !== 'object' || job === null) return false
  const j = job as Record<string, unknown>
  return (
    typeof j.id === 'number' &&
    typeof j.name === 'string' &&
    typeof j.prefix === 'string' &&
    typeof j.retries_remaining === 'number'
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
    position: 'relative',
    // Deep-link target scrolling under Layout's sticky ContentBar (64px). The
    // unit is explicit: JSS's default-unit plugin has no scroll-margin entry, so
    // a bare number emits a declaration the browser drops.
    scrollMarginTop: `${64 + t.spacing(2)}px`,
  },
  activity: {
    borderTopLeftRadius: 'inherit',
    borderTopRightRadius: 'inherit',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    // Motion is the only honest progress signal: the registry stores an opaque
    // S3 resume cursor, never a denominator. Frozen, the strip would sit empty or
    // full, and full claims the completion this panel cannot know.
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
    ...t.typography.monospace,
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
  // An emptied index nothing is still working on needs the louder register: it
  // is terminal until an admin starts the re-index again.
  error: {
    background: fade(t.palette.error.main, 0.12),
    borderRadius: t.shape.borderRadius,
    color: t.palette.error.dark,
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
    const ctl = new AbortController()
    let timer = 0
    try {
      // APIConnector base is `${registryUrl}/api`, so endpoint is relative to /api.
      const data = (await Promise.race([
        req({ endpoint: '/bulk_scanner_jobs', method: 'GET', signal: ctl.signal }),
        // The race is what rejects, not the abort: the deadline must hold even
        // if the injected transport ignores the signal.
        new Promise<never>((_resolve, reject) => {
          timer = window.setTimeout(() => {
            ctl.abort()
            reject(new Error('Timed out'))
          }, REQUEST_TIMEOUT_MS)
        }),
      ])) as { results?: ScannerJob[] }
      // Discard superseded responses (Refresh racing the poll loop).
      if (seq !== seqRef.current) return
      // A malformed payload must not land as the reassuring "no scanner jobs
      // queued" state, which an admin reads as a fact about the cluster.
      if (!data || !Array.isArray(data.results) || !data.results.every(isScannerJob)) {
        throw new Error('Malformed response')
      }
      setJobs(data.results)
      setError(null)
    } catch (e) {
      if (seq !== seqRef.current) return
      // eslint-disable-next-line no-console
      console.error(e)
      setError('Could not load scanner jobs')
    } finally {
      window.clearTimeout(timer)
    }
  }, [req])

  // The gap is measured from the previous answer, not a fixed interval: against
  // a slow registry, stacked requests would each be superseded by a newer poll,
  // and the `seq` guard would suppress the banner forever.
  React.useEffect(() => {
    let stopped = false
    let timer = 0
    const cycle = async () => {
      await load()
      if (!stopped) timer = window.setTimeout(cycle, pollMs)
    }
    cycle()
    return () => {
      stopped = true
      // Supersede any in-flight request so its response cannot set state on an
      // unmounted component; the guards in `load` already discard stale seqs.
      seqRef.current += 1
      window.clearTimeout(timer)
    }
  }, [load, pollMs])

  return { jobs, error, reload: load }
}

type Movement = { cursor: string; seenAt: number; moved: boolean }

// The resume cursor advancing between polls is the only evidence this endpoint
// offers that a scan is running; `retries_remaining` merely says the job has not
// given up.
function useCursorMovement(jobs: ScannerJob[] | null) {
  const seen = React.useRef(new Map<number, Movement>())

  return React.useMemo(() => {
    if (!jobs) return 0
    const now = Date.now()
    const next = new Map<number, Movement>()
    let moving = 0
    for (const job of jobs) {
      // An exhausted job will not advance again, so it must not keep a recent
      // advance alive -- that would animate the strip past the point where the
      // label has already dropped the job from the queue count.
      if (job.retries_remaining <= 0) continue
      const cursor = `${job.next_key_marker ?? ''}\u0000${job.next_version_id_marker ?? ''}`
      const prev = seen.current.get(job.id)
      // First sight has no baseline to compare against, so it counts as neither
      // advancing nor stalled until the next poll.
      const entry: Movement =
        prev == null
          ? { cursor, seenAt: now, moved: false }
          : prev.cursor === cursor
            ? prev
            : { cursor, seenAt: now, moved: true }
      next.set(job.id, entry)
      if (entry.moved && now - entry.seenAt < PROGRESS_TTL_MS) moving += 1
    }
    // Completed jobs are deleted server-side; drop them so the map cannot grow
    // without bound across a long-lived Status tab.
    seen.current = next
    return moving
  }, [jobs])
}

function useBucketShardDepths() {
  const result = useQuery(BUCKET_CONFIGS_QUERY)

  return React.useMemo(() => {
    const next: Record<string, number | null> = {}
    for (const b of result.data?.bucketConfigs ?? []) {
      next[b.name] = b.scannerParallelShardsDepth
    }
    return next
  }, [result.data])
}

function Warning({
  children,
  severity = 'warning',
}: React.PropsWithChildren<{ severity?: 'warning' | 'error' }>) {
  const classes = useStyles()
  return (
    <div className={severity === 'error' ? classes.error : classes.warning}>
      <M.Typography variant="body2" color="inherit">
        {children}
      </M.Typography>
    </div>
  )
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
    const live = new Set<string>()
    const stalled = new Set<string>()
    for (const job of jobs ?? []) {
      // Full-bucket wipe only: a prefix or top-level-only scan leaves the rest
      // of the index in place.
      if (job.prefix || job.ignore_dirs) continue
      // Skip until shard config for this bucket is known — unknown must not warn.
      if (!Object.prototype.hasOwnProperty.call(shardDepths, job.name)) continue
      const depth = shardDepths[job.name]
      // Only warn where grounding is honest: unsharded buckets.
      if (depth != null && depth !== 0) continue
      if (job.retries_remaining > 0) live.add(job.name)
      else stalled.add(job.name)
    }
    return {
      // A bucket with another job still trying is covered by the live warning;
      // it must not also read as abandoned.
      stalled: [...stalled].filter((n) => !live.has(n)).sort(),
      live: [...live].sort(),
    }
  }, [jobs, shardDepths])

  // `retries_remaining > 0` only means "not exhausted" -- true of a stalled job
  // as much as a working one -- so it sizes the queue and nothing more.
  const outstanding = jobs?.filter((j) => j.retries_remaining > 0).length ?? 0
  const advancing = useCursorMovement(jobs)
  const loading = jobs === null && !error
  // Motion stands for observed progress, so it needs a cursor that actually
  // moved. A failed poll leaves `jobs` at its last good value, which would
  // otherwise animate over data that is minutes stale.
  const showActivity = advancing > 0 && !error

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

      {/* The strip is decorative, so this is the only channel for a state
          change; it stays mounted because a region that appears with its own
          content is not announced. */}
      <div aria-live="polite" className={classes.activeLabel}>
        {error ? (
          <M.Typography variant="body2" color="error">
            {error} &mdash; retry with Refresh.
          </M.Typography>
        ) : (
          jobs && (
            <M.Typography variant="body2" color="inherit">
              {outstanding === 0
                ? 'No jobs outstanding'
                : `${outstanding} ${outstanding === 1 ? 'job' : 'jobs'} queued · ${
                    advancing > 0
                      ? `${advancing} advancing, no completion estimate`
                      : 'no cursor movement observed yet'
                  }`}
            </M.Typography>
          )
        )}
      </div>

      <div className={classes.caveatBlock}>
        <M.Typography variant="body2" className={classes.caveat}>
          Position is the S3 list resume cursor, not a percentage. A job counts as
          advancing while that cursor keeps moving between refreshes; when it stops, or
          the job runs out of attempts, it reads as queued again — which looks the same
          here whether a worker has picked it up or not.
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

      {/* Both warnings outlive a failed poll: unlike the activity strip, they
          describe a state that persists whether or not the panel can refresh. */}
      {emptySearchBuckets.live.length > 0 && (
        <Warning>
          Full-bucket re-index in progress for {emptySearchBuckets.live.join(', ')}.
          Search for{' '}
          {emptySearchBuckets.live.length === 1 ? 'that bucket' : 'those buckets'} returns
          nothing until the rescan finishes.
        </Warning>
      )}

      {emptySearchBuckets.stalled.length > 0 && (
        <Warning severity="error">
          Full-bucket re-index out of attempts for {emptySearchBuckets.stalled.join(', ')}
          . Search for{' '}
          {emptySearchBuckets.stalled.length === 1 ? 'that bucket' : 'those buckets'}{' '}
          stays empty until the re-index is started again.
        </Warning>
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
                  <M.TableCell>{job.name}</M.TableCell>
                  <M.TableCell>{scopeLabel(job)}</M.TableCell>
                  {/* Wraps rather than truncating: a tooltip would be the only
                      copy of the one value an admin compares across refreshes,
                      and is unreachable without a pointer. */}
                  <M.TableCell className={classes.mono}>{cursor}</M.TableCell>
                  <M.TableCell>
                    {dateFns.isValid(created)
                      ? dateFns.formatDistanceToNow(created, { addSuffix: true })
                      : '—'}
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
