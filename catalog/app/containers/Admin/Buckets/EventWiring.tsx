import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as GQL from 'utils/GraphQL'
import copyToClipboard from 'utils/clipboard'

import ADMIT_MUTATION from './gql/EventBridgeAccountAdmit.generated'
import REMOVE_MUTATION from './gql/EventBridgeAccountRemove.generated'
import EVENT_WIRING_QUERY from './gql/EventWiring.generated'

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

export type Wiring = NonNullable<
  NonNullable<
    GQL.DataForDoc<typeof EVENT_WIRING_QUERY>['bucketConfig']
  >['eventBridgeWiring']
>

const FORWARDER_ROLE = 'quilt-eventbridge-forwarder'

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

const json = (v: unknown) => shellQuote(JSON.stringify(v))

export function commands(bucket: string, wiring: Wiring, account: string) {
  const sameAccount = account === wiring.stackAccountId
  const partition = wiring.stackBusArn.split(':')[1]
  const role = sameAccount
    ? wiring.forwardingRoleArn
    : `arn:${partition}:iam::${account}:role/${FORWARDER_ROLE}`
  const b = shellQuote(bucket)
  const r = shellQuote(wiring.ruleName)
  // Chained with && so a failed read never writes a configuration that drops the
  // bucket's other targets; -s turns the empty output of an unconfigured bucket into {}.
  const enable = [
    `aws s3api get-bucket-notification-configuration --bucket ${b} --output json > nc.json`,
    `jq -s '(.[0] // {}) + {EventBridgeConfiguration: {}}' nc.json > nc2.json`,
    `aws s3api put-bucket-notification-configuration --bucket ${b} --notification-configuration file://nc2.json --skip-destination-validation`,
  ].join(' && \\\n  ')
  // Not chained: create-role fails once the role exists, and a second stack fed from
  // this account still needs its own policy on the role.
  const forwarder = sameAccount
    ? null
    : [
        `aws iam create-role --role-name ${FORWARDER_ROLE} --assume-role-policy-document ${json(
          {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: 'events.amazonaws.com' },
                Action: 'sts:AssumeRole',
              },
            ],
          },
        )}`,
        `aws iam put-role-policy --role-name ${FORWARDER_ROLE} --policy-name ${shellQuote(
          `quilt-${wiring.stackAccountId}-${wiring.stackRegion}-${wiring.stackBusArn.split('/').pop()}`.slice(
            0,
            128,
          ),
        )} --policy-document ${json({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: 'events:PutEvents',
              Resource: wiring.stackBusArn,
            },
          ],
        })}`,
      ].join('\n')
  const rule = [
    `aws events put-rule --name ${r} --event-pattern ${json(wiring.eventPattern)}`,
    `aws events put-targets --rule ${r} --targets ${shellQuote(
      `Id=quilt-stack-bus,Arn=${wiring.stackBusArn},RoleArn=${role}`,
    )}`,
  ].join(' && \\\n  ')
  return { enable, forwarder, role, rule }
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
          Skipped. New objects reach search only on the next bulk scan. EventBridge wiring
          gives this bucket live updates without touching its notification targets.
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

interface AdmissionProps {
  account: string
  admitted: boolean
  onChange: (admitted: string[]) => void
}

function Admission({ account, admitted, onChange }: AdmissionProps) {
  const admit = GQL.useMutation(ADMIT_MUTATION)
  const remove = GQL.useMutation(REMOVE_MUTATION)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const toggle = React.useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const r = admitted
        ? (await remove({ accountId: account })).admin.eventBridgeAccountRemove
        : (await admit({ accountId: account })).admin.eventBridgeAccountAdmit
      switch (r.__typename) {
        case 'EventBridgeAccountsSuccess':
          onChange([...r.accounts.admitted])
          break
        case 'EventBridgeAccountInvalid':
          setError('Enter a 12-digit AWS account ID')
          break
        case 'OperationError':
          setError(r.message)
          break
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `${e}`)
    } finally {
      setBusy(false)
    }
  }, [account, admitted, admit, remove, onChange])
  return (
    <>
      <M.Typography variant="body2">
        {admitted
          ? `Account ${account} can put events on this stack’s event bus.`
          : `Admit account ${account} so its rules can put events on this stack’s event bus.`}{' '}
        <M.Button size="small" variant="outlined" onClick={toggle} disabled={busy}>
          {admitted ? 'Remove' : 'Admit account'}
        </M.Button>
      </M.Typography>
      {error && <Lab.Alert severity="error">{error}</Lab.Alert>}
    </>
  )
}

interface PanelProps {
  bucket: string
  prefixes: readonly string[] | null
  wiring: Wiring
  admitted: readonly string[]
  onAdmittedChange: (admitted: string[]) => void
}

export function Panel({
  bucket,
  prefixes,
  wiring,
  admitted,
  onAdmittedChange,
}: PanelProps) {
  const classes = useStyles()
  const [account, setAccount] = React.useState(wiring.stackAccountId)
  const accountValid = ACCOUNT_RE.test(account)
  const sameAccount = account === wiring.stackAccountId
  const cmds = accountValid ? commands(bucket, wiring, account) : null
  return (
    <>
      <M.TextField
        id="event-wiring-account"
        label="Bucket account ID"
        value={account}
        onChange={(e) => setAccount(e.target.value.trim())}
        error={!accountValid}
        helperText={
          !accountValid
            ? 'Enter a 12-digit AWS account ID'
            : sameAccount
              ? 'This stack’s account'
              : 'Another account'
        }
        size="small"
      />
      {accountValid && !sameAccount && (
        <div className={classes.step}>
          <Admission
            key={account}
            account={account}
            admitted={admitted.includes(account)}
            onChange={onAdmittedChange}
          />
        </div>
      )}
      {cmds && (
        <>
          <M.Typography variant="body2" className={classes.step}>
            Run these as an admin of account {account}, in the bucket’s region.
          </M.Typography>
          <M.Typography variant="body2" className={classes.step}>
            <strong>1.</strong> Turn on EventBridge for <code>{bucket}</code>. Its
            existing SNS, SQS and Lambda notification targets are kept, not replaced.
          </M.Typography>
          <Code>{cmds.enable}</Code>
          <M.Typography variant="body2" className={classes.step}>
            <strong>2.</strong>{' '}
            {cmds.forwarder ? (
              <>
                Create the forwarding role, once per account. It lets the rule put events
                on this stack’s event bus.
              </>
            ) : (
              <>
                The rule forwards through this stack’s role <code>{cmds.role}</code>;
                there is nothing to create.
              </>
            )}
          </M.Typography>
          {cmds.forwarder && <Code>{cmds.forwarder}</Code>}
          <M.Typography variant="body2" className={classes.step}>
            <strong>3.</strong> Create the rule and point it at this stack’s event bus. A
            stack-side normalizer feeds search, package events and your EventBridge rules
            in the same shapes as today
            {prefixes?.some(Boolean) &&
              '. Unlike today, live updates then cover only the scoped prefixes and .quilt/: writes elsewhere reach search only on a bulk scan'}
            .
          </M.Typography>
          <Code>{cmds.rule}</Code>
        </>
      )}
      <M.Typography variant="body2" className={classes.step}>
        <strong>Events received (24h):</strong> {wiring.eventsLast24h ?? 'unknown'}
      </M.Typography>
    </>
  )
}

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
  // Refetched on every open: the event count moves, and the cached admitted list never
  // sees the mutations' answers, which land under the mutation root.
  const query = GQL.useQuery(
    EVENT_WIRING_QUERY,
    { bucket },
    { requestPolicy: 'cache-and-network' },
  )
  const [admitted, setAdmitted] = React.useState<string[] | null>(null)
  const today = currentWiring(snsNotificationArn)

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
        <M.Typography variant="subtitle2">Today</M.Typography>
        <M.Typography variant="body2">
          <Today wiring={today} />
        </M.Typography>

        <M.Typography variant="subtitle2" className={classes.step}>
          EventBridge wiring
        </M.Typography>
        {GQL.fold(query, {
          data: ({ bucketConfig, admin }) =>
            bucketConfig?.eventBridgeWiring ? (
              <>
                {today.kind !== 'skipped' && (
                  <Lab.Alert severity="warning" className={classes.step}>
                    Set this bucket to Skip S3 notifications before wiring it, or its
                    events reach the stack twice.
                  </Lab.Alert>
                )}
                <Panel
                  bucket={bucket}
                  prefixes={prefixes}
                  wiring={bucketConfig.eventBridgeWiring}
                  admitted={admitted ?? admin.eventBridgeAccounts.admitted}
                  onAdmittedChange={setAdmitted}
                />
              </>
            ) : (
              <M.Typography variant="body2">
                This stack doesn’t support EventBridge wiring yet.
              </M.Typography>
            ),
          fetching: () => <M.CircularProgress size={24} />,
          error: (e) => <Lab.Alert severity="error">{e.message}</Lab.Alert>,
        })}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
