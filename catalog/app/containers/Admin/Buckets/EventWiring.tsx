import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import copyToClipboard from 'utils/clipboard'

// Preview of the proposed EventBridge notification mode. It reads only what the bucket
// record already carries and applies nothing: the registry has no such mode yet, so
// every value it cannot know (stack account, stack id) is shown as a named placeholder.

const SNS_ARN_RE = /^arn:aws[\w-]*:sns:([\w-]+):(\d{12}):(\S+)$/

export type CurrentWiring =
  | { kind: 'skipped' }
  | { kind: 'unconfigured' }
  | { kind: 'topic'; arn: string; region: string; account: string; managed: boolean }
  | { kind: 'unparsed'; arn: string }

export function currentWiring(snsArn: string | null | undefined): CurrentWiring {
  if (!snsArn) return { kind: 'unconfigured' }
  if (snsArn === 'DO_NOT_SUBSCRIBE') return { kind: 'skipped' }
  const m = SNS_ARN_RE.exec(snsArn)
  if (!m) return { kind: 'unparsed', arn: snsArn }
  // Topics the registry creates are named `<bucket>-QuiltNotifications-<uuid>`.
  return {
    kind: 'topic',
    arn: snsArn,
    region: m[1],
    account: m[2],
    managed: m[3].includes('-QuiltNotifications-'),
  }
}

// Live events must keep covering `.quilt/` even when the bulk scan is prefix-scoped,
// or package events and Iceberg stop for that bucket.
export function rulePattern(bucket: string, prefixes: readonly string[] | null) {
  const scoped = (prefixes || []).filter(Boolean)
  const detail: Record<string, unknown> = { bucket: { name: [bucket] } }
  if (scoped.length) {
    const keys = Array.from(new Set([...scoped, '.quilt/']))
    detail.object = { key: keys.map((prefix) => ({ prefix })) }
  }
  return {
    source: ['aws.s3'],
    'detail-type': ['Object Created', 'Object Deleted'],
    detail,
  }
}

const ACCOUNT_RE = /^\d{12}$/

const useStyles = M.makeStyles((t) => ({
  step: {
    marginTop: t.spacing(2),
  },
  code: {
    ...t.typography.body2,
    background: t.palette.grey[100],
    borderRadius: t.shape.borderRadius,
    fontFamily: t.typography.monospace.fontFamily,
    margin: t.spacing(1, 0, 0),
    overflowX: 'auto',
    padding: t.spacing(1, 1.5),
  },
  health: {
    marginTop: t.spacing(1),
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
  },
}))

interface CodeProps {
  children: string
}

function Code({ children }: CodeProps) {
  const classes = useStyles()
  const [copied, setCopied] = React.useState(false)
  // The copy helper's scratch textarea must sit inside the dialog: the dialog's focus
  // trap pulls focus out of anything appended to document.body and the copy is lost.
  const containerRef = React.useRef<HTMLDivElement>(null)
  const copy = React.useCallback(() => {
    setCopied(copyToClipboard(children, { container: containerRef.current ?? undefined }))
  }, [children])
  return (
    <div ref={containerRef}>
      <pre className={classes.code}>{children}</pre>
      <M.Button size="small" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </M.Button>
      <span aria-live="polite" className={classes.srOnly}>
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}

export function Today({ wiring }: { wiring: CurrentWiring }) {
  switch (wiring.kind) {
    case 'skipped':
      return (
        <>
          Skipped. New objects reach search only on the next bulk scan. EventBridge mode
          would give this bucket live updates without touching its notification targets.
        </>
      )
    case 'unconfigured':
      return (
        <>
          No topic is recorded. Re-index and repair would create a Quilt topic and replace
          the bucket’s notification configuration, removing its other targets.
        </>
      )
    case 'unparsed':
      return <>Topic {wiring.arn}</>
    case 'topic':
      return (
        <>
          {wiring.managed ? 'Quilt-named' : 'Your'} SNS topic in account{' '}
          <strong>{wiring.account}</strong>, region <strong>{wiring.region}</strong>.{' '}
          {wiring.managed
            ? 'The registry likely created it, writing the bucket’s notification configuration when it had none.'
            : 'Quilt subscribes to it; the registry didn’t create it.'}{' '}
          Re-index and repair would swap it for a new Quilt topic and replace the bucket’s
          notification configuration, removing its other targets.
        </>
      )
  }
}

const SAMPLE_HEALTH = [
  {
    ok: true,
    text: 'EventBridge is on for the bucket; 2 other notification targets kept',
  },
  { ok: true, text: 'Rule enabled and targeting this stack’s event bus' },
  { ok: true, text: '18,204 events matched in the last 24 hours' },
  { ok: false, text: '3 failed deliveries in the last 24 hours' },
]

interface EventWiringProps {
  bucket: string
  prefixes: readonly string[] | null
  snsNotificationArn: string | null
  onClose: () => void
}

export default function EventWiring({
  bucket,
  prefixes,
  snsNotificationArn,
  onClose,
}: EventWiringProps) {
  const classes = useStyles()
  const wiring = currentWiring(snsNotificationArn)
  const [crossAccount, setCrossAccount] = React.useState(false)
  const [account, setAccount] = React.useState('')
  const accountValid = ACCOUNT_RE.test(account)
  const owner = crossAccount
    ? accountValid
      ? account
      : '<data account>'
    : '<stack account>'
  const pattern = JSON.stringify(rulePattern(bucket, prefixes), null, 2)

  return (
    <M.Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="event-wiring-title"
    >
      <M.DialogTitle id="event-wiring-title">Event wiring: {bucket}</M.DialogTitle>
      <M.DialogContent>
        <Lab.Alert severity="info">
          Preview of the proposed EventBridge mode. Nothing here is applied to the bucket
          or to AWS.
        </Lab.Alert>

        <M.Typography variant="subtitle2" className={classes.step}>
          Today
        </M.Typography>
        <M.Typography variant="body2">
          <Today wiring={wiring} />
        </M.Typography>

        <M.Typography variant="subtitle2" className={classes.step}>
          Where the bucket lives
        </M.Typography>
        <M.RadioGroup
          aria-label="Where the bucket lives"
          row
          value={crossAccount ? 'other' : 'stack'}
          onChange={(e) => setCrossAccount(e.target.value === 'other')}
        >
          <M.FormControlLabel
            value="stack"
            control={<M.Radio />}
            label="This stack’s account"
          />
          <M.FormControlLabel
            value="other"
            control={<M.Radio />}
            label="Another account"
          />
        </M.RadioGroup>
        {crossAccount && (
          <M.TextField
            id="event-wiring-account"
            label="Data account ID"
            value={account}
            onChange={(e) => setAccount(e.target.value.trim())}
            error={!!account && !accountValid}
            helperText={
              account && !accountValid ? 'Enter a 12-digit AWS account ID' : ' '
            }
            size="small"
          />
        )}

        <M.Typography variant="subtitle2" className={classes.step}>
          What Quilt would set up
        </M.Typography>
        {crossAccount && (
          <M.Typography variant="body2" className={classes.step}>
            <strong>Once per account:</strong> an admin of account {owner} deploys the
            Quilt connector template. It creates a role this stack assumes (with an
            external ID) and a forwarding role. No per-bucket hand wiring follows.
          </M.Typography>
        )}
        <M.Typography variant="body2" className={classes.step}>
          <strong>1.</strong> Turn on EventBridge for <code>{bucket}</code>. Its existing
          SNS, SQS and Lambda notification targets are kept, not replaced.
        </M.Typography>
        <pre className={classes.code}>{'"EventBridgeConfiguration": {}'}</pre>
        <M.Typography variant="body2" className={classes.step}>
          <strong>2.</strong> Create rule{' '}
          <code>quilt-&lt;stack id&gt;-&lt;bucket hash&gt;</code> on the default event bus
          of account {owner}, in the bucket’s region:
        </M.Typography>
        <Code>{pattern}</Code>
        <M.Typography variant="body2" className={classes.step}>
          <strong>3.</strong> Target the stack’s event bus{' '}
          <code>quilt-&lt;stack name&gt;</code>, through a role that lets the rule put
          events on it. A stack-side normalizer feeds search, package events and your
          EventBridge rules in the same shapes as today
          {prefixes?.some(Boolean) &&
            '. Unlike today, live updates then cover only the scoped prefixes and .quilt/: writes elsewhere reach search only on a bulk scan'}
          .
        </M.Typography>

        <M.Typography variant="subtitle2" className={classes.step}>
          Health (sample data, not this bucket)
        </M.Typography>
        <M.List dense className={classes.health}>
          {SAMPLE_HEALTH.map(({ ok, text }) => (
            <M.ListItem key={text} disableGutters>
              <M.ListItemIcon>
                <M.Icon color={ok ? 'primary' : 'error'}>
                  {ok ? 'check_circle' : 'error'}
                </M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary={text} />
            </M.ListItem>
          ))}
        </M.List>
      </M.DialogContent>
      <M.DialogActions>
        <M.Typography variant="caption" color="textSecondary">
          Needs registry support for the EventBridge mode
        </M.Typography>
        <M.Button color="primary" variant="contained" disabled>
          Switch to EventBridge
        </M.Button>
        <M.Button onClick={onClose}>Close</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
