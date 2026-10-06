import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import STATUS_QUERY from '../Status/gql/Status.generated'

import { REQUIREMENTS, liveCheck } from './requirements'
import type { Assessment, LiveCheck } from './requirements'

type StatusResult = Extract<
  GQL.DataForDoc<typeof STATUS_QUERY>['status'],
  { __typename: 'Status' }
>

// Same variables as the Status page, so the two screens share one cached query.
const STATUS_VARS = {
  statsWindow: 30,
  reportsPerPage: 25,
  reportsOrder: Model.GQLTypes.StatusReportListOrder.NEW_FIRST,
}

const ASSESSMENT: Record<Assessment, { label: string; color: string }> = {
  supported: { label: 'Supported', color: '#2e7d32' },
  partial: { label: 'Partial', color: '#ef6c00' },
  gap: { label: 'Gap', color: '#c62828' },
  customer: { label: 'Customer-defined', color: '#546e7a' },
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

function Qualification({ status }: { status: StatusResult | null }) {
  const { urls } = NamedRoutes.use()
  const latest = status?.reports.page[0]
  const stats = status?.latestStats
  return (
    <M.Grid container spacing={2}>
      <Card title="IQ" subtitle="Installation qualification">
        {latest ? (
          <M.Typography variant="body2">
            Latest report {latest.timestamp.toISOString()} ·{' '}
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
          <Live value="unavailable" />
        )}
      </Card>
      <Card title="OQ" subtitle="Operational qualification (canaries)">
        {stats ? (
          <M.Typography variant="body2">
            {stats.passed} passing · {stats.failed} failing · {stats.running} running
          </M.Typography>
        ) : (
          <Live value="unavailable" />
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

function exportEvidence(status: StatusResult | null) {
  const canaries = status?.canaries ?? null
  const evidence = {
    generatedAt: new Date().toISOString(),
    catalog: window.location.origin,
    statusMonitoring: status ? 'enabled' : 'not enabled',
    requirements: REQUIREMENTS.map((r) => ({ ...r, liveCheck: liveCheck(r, canaries) })),
    canaries,
    latestStats: status?.latestStats ?? null,
    recentReports: status?.reports.page ?? [],
  }
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = `gxp-evidence-${evidence.generatedAt.slice(0, 10)}.json`
  a.click()
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function GxP() {
  const classes = useStyles()
  const data = GQL.useQueryS(STATUS_QUERY, STATUS_VARS)
  const status = data.status.__typename === 'Status' ? data.status : null
  const canaries = status?.canaries ?? null

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
          onClick={() => exportEvidence(status)}
        >
          Export evidence
        </M.Button>
      </div>

      <Qualification status={status} />

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
            {REQUIREMENTS.map((r) => (
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
                  <AssessmentChip value={r.assessment} />
                </M.TableCell>
                <M.TableCell>
                  <Live value={liveCheck(r, canaries)} />
                </M.TableCell>
              </M.TableRow>
            ))}
          </M.TableBody>
        </M.Table>
      </M.Paper>
    </M.Box>
  )
}
