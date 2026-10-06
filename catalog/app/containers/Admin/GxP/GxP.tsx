import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import saveAs from 'utils/saveAs'

import {
  DEFAULT_REPORTS_ORDER,
  DEFAULT_REPORTS_PER_PAGE,
  STATS_WINDOW,
} from '../Status/constants'
import STATUS_QUERY from '../Status/gql/Status.generated'

import { REQUIREMENTS, displayedAssessment, liveCheck } from './requirements'
import type { Assessment, LiveCheck, Requirement } from './requirements'

type StatusResult = Extract<
  GQL.DataForDoc<typeof STATUS_QUERY>['status'],
  { __typename: 'Status' }
>

const STATUS_VARS = {
  statsWindow: STATS_WINDOW,
  reportsPerPage: DEFAULT_REPORTS_PER_PAGE,
  reportsOrder: DEFAULT_REPORTS_ORDER,
}

// 'off' = status monitoring is not provisioned on this stack.
type Monitoring = 'loading' | 'error' | 'off' | 'on'

// Stands in for every canary-backed check while the status query has no answer.
const PENDING_CHECK: Partial<Record<Monitoring, LiveCheck>> = {
  loading: 'loading',
  error: 'unknown',
  off: 'unavailable',
}

const ASSESSMENT: Record<Assessment, { label: string; color: string }> = {
  // Dark shades keep white chip text above 4.5:1 contrast.
  supported: { label: 'Supported', color: '#1b5e20' },
  partial: { label: 'Partial', color: '#8a3b00' },
  gap: { label: 'Gap', color: '#b71c1c' },
  customer: { label: 'Customer-defined', color: '#455a64' },
  notEnabled: { label: 'Not enabled on this stack', color: '#616161' },
  unverified: { label: 'Not verified', color: '#616161' },
}

const LIVE: Record<LiveCheck, { label: string; icon: string; color: string }> = {
  pass: { label: 'Passing', icon: 'check_circle', color: '#2e7d32' },
  fail: { label: 'Failing', icon: 'error', color: '#c62828' },
  running: { label: 'Running', icon: 'watch_later', color: '#757575' },
  missing: {
    label: 'Canary not deployed',
    icon: 'remove_circle_outline',
    color: '#757575',
  },
  unavailable: {
    label: 'Status monitoring not enabled on this stack',
    icon: 'cloud_off',
    color: '#757575',
  },
  loading: { label: 'Checking…', icon: 'hourglass_empty', color: '#757575' },
  unknown: {
    label: 'Status could not be loaded',
    icon: 'help_outline',
    color: '#757575',
  },
}

const useStyles = M.makeStyles((t) => ({
  header: {
    alignItems: 'flex-start',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(2),
  },
  card: {
    height: '100%',
    padding: t.spacing(2),
  },
  chip: {
    color: t.palette.common.white,
    fontWeight: t.typography.fontWeightMedium,
  },
  live: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(0.5),
  },
  anchor: {
    color: t.palette.text.secondary,
    display: 'block',
  },
}))

function AssessmentChip({ value }: { value: Assessment }) {
  const classes = useStyles()
  const { label, color } = ASSESSMENT[value]
  return (
    <M.Chip
      size="small"
      label={label}
      className={classes.chip}
      style={{ background: color }}
    />
  )
}

function Live({ value }: { value: LiveCheck | null }) {
  const classes = useStyles()
  if (!value) return <M.Typography color="textSecondary">—</M.Typography>
  const { label, icon, color } = LIVE[value]
  return (
    <span className={classes.live}>
      <M.Icon fontSize="small" style={{ color }}>
        {icon}
      </M.Icon>
      <M.Typography variant="body2">{label}</M.Typography>
    </span>
  )
}

interface CardProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

function Card({ title, subtitle, children }: CardProps) {
  const classes = useStyles()
  return (
    <M.Grid item xs={12} md={4}>
      <M.Paper variant="outlined" className={classes.card}>
        <M.Typography variant="h6">{title}</M.Typography>
        <M.Typography variant="body2" color="textSecondary" gutterBottom>
          {subtitle}
        </M.Typography>
        {children}
      </M.Paper>
    </M.Grid>
  )
}

interface QualificationProps {
  monitoring: Monitoring
  status: StatusResult | null
}

function Qualification({ monitoring, status }: QualificationProps) {
  const pending = <Live value={PENDING_CHECK[monitoring] ?? null} />
  const { urls } = NamedRoutes.use()
  const latest = status?.reports.page[0]
  const stats = status?.latestStats
  return (
    <M.Grid container spacing={2}>
      <Card title="IQ" subtitle="Installation qualification">
        {latest ? (
          <M.Typography variant="body2">
            Latest IQ snapshot {latest.timestamp.toISOString()} ·{' '}
            <RRDom.Link
              to={urls.bucketFile(
                latest.renderedReportLocation.bucket,
                latest.renderedReportLocation.key,
                { version: latest.renderedReportLocation.version },
              )}
            >
              view
            </RRDom.Link>
          </M.Typography>
        ) : status ? (
          <M.Typography variant="body2">No report yet</M.Typography>
        ) : (
          pending
        )}
      </Card>
      <Card title="OQ" subtitle="Operational qualification (canaries)">
        {stats ? (
          <M.Typography variant="body2">
            {stats.passed} passing · {stats.failed} failing · {stats.running} running
          </M.Typography>
        ) : (
          pending
        )}
      </Card>
      <Card title="PQ" subtitle="Performance qualification">
        <M.Typography variant="body2">
          Defined and run by you, in your process.
        </M.Typography>
      </Card>
    </M.Grid>
  )
}

// Drops GraphQL `__typename` so the export reads as data, not a query result.
const stripTypename = (x: unknown) =>
  JSON.parse(JSON.stringify(x ?? null, (k, v) => (k === '__typename' ? undefined : v)))

function checkFor(r: Requirement, monitoring: Monitoring, status: StatusResult | null) {
  if (monitoring === 'on') return liveCheck(r, status?.canaries ?? [])
  return r.canary ? (PENDING_CHECK[monitoring] ?? null) : null
}

function exportEvidence(monitoring: Monitoring, status: StatusResult | null) {
  const canaries = status?.canaries ?? null
  const evidence = {
    disclaimer:
      'Snapshot from the Quilt catalog, timestamped by the browser clock and unsigned. Supports your validation; it is not a certification.',
    generatedAt: new Date().toISOString(),
    catalog: window.location.origin,
    stackVersion: cfg.stackVersion,
    statusMonitoring: monitoring,
    requirements: REQUIREMENTS.map((r) => {
      const live = checkFor(r, monitoring, status)
      return { ...r, liveCheck: live, displayedAssessment: displayedAssessment(r, live) }
    }),
    canaries: stripTypename(canaries),
    latestStats: stripTypename(status?.latestStats),
    recentReports: stripTypename(status?.reports.page ?? []),
  }
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' })
  saveAs(blob, `gxp-evidence-${evidence.generatedAt.slice(0, 10)}.json`)
}

export default function GxP() {
  const classes = useStyles()
  // Not the suspending variant: a failed status read must not take the static
  // requirements catalogue and the export down with it.
  const result = GQL.useQuery(STATUS_QUERY, STATUS_VARS)
  const status = result.data?.status.__typename === 'Status' ? result.data.status : null
  const monitoring: Monitoring = status
    ? 'on'
    : result.data
      ? 'off'
      : result.error
        ? 'error'
        : 'loading'

  return (
    <M.Box my={2}>
      <MetaTitle>{['GxP', 'Admin']}</MetaTitle>
      <div className={classes.header}>
        <div>
          <M.Typography variant="h5">GxP validation</M.Typography>
          <M.Typography variant="body2" color="textSecondary">
            How Quilt supports your validation. You validate your system; this page is
            evidence, not a certification.
          </M.Typography>
        </div>
        <M.Button
          variant="outlined"
          color="primary"
          startIcon={<M.Icon>save_alt</M.Icon>}
          disabled={monitoring === 'loading'}
          onClick={() => exportEvidence(monitoring, status)}
        >
          Export evidence
        </M.Button>
      </div>

      {(monitoring === 'off' || monitoring === 'error') && (
        <M.Box mb={2}>
          <M.Paper variant="outlined">
            <M.Box p={2}>
              <M.Typography variant="body2">
                {monitoring === 'off'
                  ? 'GxP status monitoring (canaries and status reports) is not enabled on this stack, so only the requirements catalogue is shown.'
                  : `Status could not be loaded (${result.error?.message}), so the requirements catalogue is shown without live checks.`}
              </M.Typography>
            </M.Box>
          </M.Paper>
        </M.Box>
      )}

      <Qualification monitoring={monitoring} status={status} />

      <M.Box pt={3} pb={1}>
        <M.Typography variant="h6">Requirements traceability</M.Typography>
      </M.Box>
      <M.Paper variant="outlined">
        <M.Table size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell>ID</M.TableCell>
              <M.TableCell>Requirement</M.TableCell>
              <M.TableCell>Quilt control</M.TableCell>
              <M.TableCell>Evidence</M.TableCell>
              <M.TableCell>Assessment</M.TableCell>
              <M.TableCell>Live check</M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {REQUIREMENTS.map((r) => {
              const live = checkFor(r, monitoring, status)
              return (
                <M.TableRow key={r.id}>
                  <M.TableCell>{r.id}</M.TableCell>
                  <M.TableCell>
                    {r.requirement}
                    <M.Typography variant="caption" className={classes.anchor}>
                      {r.anchor}
                    </M.Typography>
                  </M.TableCell>
                  <M.TableCell>{r.control}</M.TableCell>
                  <M.TableCell>{r.evidence}</M.TableCell>
                  <M.TableCell>
                    <AssessmentChip value={displayedAssessment(r, live)} />
                  </M.TableCell>
                  <M.TableCell>
                    <Live value={live} />
                  </M.TableCell>
                </M.TableRow>
              )
            })}
          </M.TableBody>
        </M.Table>
      </M.Paper>
    </M.Box>
  )
}
