import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as APIConnector from 'utils/APIConnector'

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

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.common.white,
    borderRadius: t.shape.borderRadius,
    padding: t.spacing(2),
    position: 'relative',
  },
  titleRow: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(1),
  },
  mono: {
    fontFamily: 'Roboto Mono, monospace',
    wordBreak: 'break-all',
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
    marginBottom: t.spacing(1.5),
  },
  empty: {
    color: t.palette.text.secondary,
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

  const load = React.useCallback(async () => {
    try {
      const data = (await req({
        endpoint: '/api/bulk_scanner_jobs',
        method: 'GET',
      })) as { results?: ScannerJob[] }
      setJobs(data.results ?? [])
      setError(null)
    } catch (e) {
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
  const req = APIConnector.use()
  const [byName, setByName] = React.useState<Record<string, number | null>>({})

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = (await req({
          endpoint: '/graphql',
          method: 'POST',
          body: {
            query: '{ bucketConfigs { name scannerParallelShardsDepth } }',
          },
        })) as {
          data?: { bucketConfigs?: BucketShardInfo[] }
        }
        if (cancelled) return
        const next: Record<string, number | null> = {}
        for (const b of data.data?.bucketConfigs ?? []) {
          next[b.name] = b.scannerParallelShardsDepth
        }
        setByName(next)
      } catch (e) {
        // Panel still works without shard depths; empty-search warning stays off.
        // eslint-disable-next-line no-console
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [req])

  return byName
}

export default function Indexing() {
  const classes = useStyles()
  const { jobs, error, reload } = useBulkScannerJobs(POLL_MS)
  const shardDepths = useBucketShardDepths()

  const emptySearchBuckets = React.useMemo(() => {
    if (!jobs) return []
    const names = new Set<string>()
    for (const job of jobs) {
      if (job.prefix !== '') continue
      const depth = shardDepths[job.name]
      // Only warn where grounding is honest: unsharded buckets.
      if (depth == null || depth === 0) {
        names.add(job.name)
      }
    }
    return [...names].sort()
  }, [jobs, shardDepths])

  return (
    <div className={classes.root} id="indexing">
      <div className={classes.titleRow}>
        <M.Typography variant="h5">Indexing</M.Typography>
        <M.Button size="small" onClick={reload} disabled={jobs === null && !error}>
          Refresh
        </M.Button>
      </div>

      <M.Typography variant="body2" className={classes.caveat}>
        Position is the S3 list resume cursor (not a percentage). Job age is time since
        creation; a healthy large scan yields after about 20&nbsp;000 keys and is checked
        out again with the same creation time, so age alone cannot tell progressing from
        stalled — watch the cursor across refreshes. ETA is unknown because completed jobs
        are deleted. Queue order is newest-first, not FIFO. This panel does not report
        search-cluster health.
      </M.Typography>

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
          {error}
        </M.Typography>
      )}

      {jobs === null && !error && (
        <M.Box py={2} display="flex" justifyContent="center">
          <M.CircularProgress size={28} />
        </M.Box>
      )}

      {jobs && jobs.length === 0 && (
        <M.Typography className={classes.empty}>No scanner jobs queued.</M.Typography>
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
              return (
                <M.TableRow
                  key={job.id}
                  className={exhausted ? classes.exhausted : undefined}
                >
                  <M.TableCell className={classes.mono}>{job.name}</M.TableCell>
                  <M.TableCell>{scopeLabel(job)}</M.TableCell>
                  <M.TableCell className={classes.mono}>
                    {job.next_key_marker
                      ? job.next_key_marker
                      : exhausted
                        ? '—'
                        : 'start'}
                  </M.TableCell>
                  <M.TableCell>
                    {dateFns.formatDistanceToNow(created, { addSuffix: true })}
                    {exhausted && ' · exhausted'}
                  </M.TableCell>
                  <M.TableCell align="right">{job.retries_remaining}</M.TableCell>
                </M.TableRow>
              )
            })}
          </M.TableBody>
        </M.Table>
      )}
    </div>
  )
}
