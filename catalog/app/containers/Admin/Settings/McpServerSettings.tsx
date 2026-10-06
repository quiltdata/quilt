import * as React from 'react'
import * as M from '@material-ui/core'
import * as Sentry from '@sentry/react'

import { toolNameFitsBedrock } from 'components/Assistant/Model/Connectors'
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'
// Value import, not `import type`: `McpServerAuth` is a generated enum and the
// mutation sends one of its members.
import * as Types from 'model/graphql/types.generated'

import MCP_SERVERS_QUERY from './gql/McpServers.generated'
import MCP_SERVER_PROBE_MUTATION from './gql/McpServerProbe.generated'
import MCP_SERVER_REMOVE_MUTATION from './gql/McpServerRemove.generated'
import MCP_SERVER_SET_MUTATION from './gql/McpServerSet.generated'

type Server = GQL.DataForDoc<typeof MCP_SERVERS_QUERY>['admin']['mcpServers'][number]

type Probe = GQL.DataForDoc<typeof MCP_SERVER_PROBE_MUTATION>['admin']['mcpServerProbe']

/**
 * The full input for `server` with `overrides` applied. A null `secret` keeps
 * the stored one.
 */
const toInput = (
  server: Server,
  overrides: Partial<Types.McpServerInput> = {},
): Types.McpServerInput => ({
  title: server.title,
  url: server.url,
  hint: server.hint,
  enabled: server.enabled,
  trusted: server.trusted,
  auth: server.auth,
  authHeader: server.authHeader,
  authPrefix: server.authPrefix,
  forwardIdentity: server.forwardIdentity,
  secret: null,
  ...overrides,
})

/** The registry connects to the saved server and lists its tools, as the relay would. */
function useProbe(slug: string) {
  const probeMutation = GQL.useMutation(MCP_SERVER_PROBE_MUTATION)
  const [probing, setProbing] = React.useState(false)
  const [probe, setProbe] = React.useState<Probe | null>(null)
  const check = React.useCallback(async () => {
    if (probing) return
    setProbing(true)
    setProbe(null)
    try {
      setProbe((await probeMutation({ slug })).admin.mcpServerProbe)
    } catch (e) {
      Sentry.captureException(e)
      setProbe({
        __typename: 'McpServerProbe',
        ok: false,
        failure: `The check itself failed: ${e}`,
        tools: [],
      })
    } finally {
      setProbing(false)
    }
  }, [slug, probing, probeMutation])
  return { probe, probing, check }
}

const useStyles = M.makeStyles((t) => ({
  row: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: t.spacing(2),
    padding: t.spacing(2, 0),
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  heading: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
  endpoint: {
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
    fontSize: '0.75rem',
    overflowWrap: 'anywhere',
  },
  note: {
    marginTop: t.spacing(0.5),
  },
  probeOk: {
    borderLeft: `3px solid ${t.palette.success.main}`,
    marginTop: t.spacing(1),
    padding: t.spacing(0.5, 1.5),
  },
  probeBad: {
    borderLeft: `3px solid ${t.palette.error.main}`,
    marginTop: t.spacing(1),
    padding: t.spacing(0.5, 1.5),
  },
  tools: {
    display: 'grid',
    gap: t.spacing(0.5),
    listStyle: 'none',
    margin: t.spacing(1, 0, 0),
    padding: 0,
  },
  tool: {
    ...t.typography.caption,
    background: t.palette.action.hover,
    borderRadius: 3,
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
    padding: t.spacing(0.125, 0.5),
  },
  toolFlagged: {
    background: (t.palette.warning as $TSFixMe).light,
    color: (t.palette.warning as $TSFixMe).dark,
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    marginTop: t.spacing(2),
  },
  form: {
    display: 'grid',
    gap: t.spacing(2),
    marginTop: t.spacing(1),
  },
  formRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(2),
  },
  error: {
    ...t.typography.body2,
    color: t.palette.error.main,
    marginTop: t.spacing(1),
  },
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    padding: t.spacing(2, 0),
  },
}))

/** Annotations are the server's own claims, so they inform the admin and gate nothing. */
const toolFlags = (t: Probe['tools'][number]) =>
  [
    t.readOnly && 'read-only',
    t.destructive && 'destructive',
    t.openWorld && 'open-world',
  ].filter(Boolean) as string[]

interface ProbeBlockProps {
  result: Probe
  /** The prefix the assistant will apply; part of what Bedrock validates. */
  slug: string
}

function ProbeBlock({ result, slug }: ProbeBlockProps) {
  const classes = useStyles()
  const unusable = (name: string) => !toolNameFitsBedrock(`${slug}__${name}`)
  const unusableNames = result.tools.map((t) => t.name).filter(unusable)
  return (
    <div className={result.ok ? classes.probeOk : classes.probeBad}>
      <M.Typography variant="body2">
        {result.ok
          ? `Connected, ${result.tools.length} ${result.tools.length === 1 ? 'tool' : 'tools'}`
          : 'Could not list its tools'}
      </M.Typography>
      {result.failure && (
        <M.Typography variant="caption" color="textSecondary" component="p">
          {result.failure}
        </M.Typography>
      )}
      {result.tools.length > 0 && (
        <>
          <ul className={classes.tools}>
            {result.tools.map((t) => (
              <li key={t.name} title={t.description ?? undefined}>
                <span
                  className={
                    t.destructive || unusable(t.name)
                      ? `${classes.tool} ${classes.toolFlagged}`
                      : classes.tool
                  }
                >
                  {t.name}
                </span>{' '}
                {toolFlags(t).map((f) => (
                  <M.Chip key={f} size="small" variant="outlined" label={f} />
                ))}
              </li>
            ))}
          </ul>
          {unusableNames.length > 0 && (
            <M.Typography
              className={classes.note}
              variant="caption"
              color="textSecondary"
              component="p"
            >
              {unusableNames.length === 1
                ? 'One tool name'
                : `${unusableNames.length} tool names`}{' '}
              cannot be offered to the model once prefixed with <code>{slug}__</code>:
              only letters, digits, <code>_</code> and <code>-</code> are allowed, up to
              64 characters. The assistant drops them.
            </M.Typography>
          )}
        </>
      )}
    </div>
  )
}

interface ServerFormValues {
  slug: string
  title: string
  url: string
  hint: string
  auth: Types.McpServerAuth
  authHeader: string
  authPrefix: string
  secret: string
}

const EMPTY_FORM: ServerFormValues = {
  slug: '',
  title: '',
  url: '',
  hint: '',
  auth: Types.McpServerAuth.NONE,
  authHeader: '',
  authPrefix: '',
  secret: '',
}

interface ServerFormProps {
  /** Present when editing: the slug is the identity and cannot change. */
  existing?: Server
  onClose: () => void
  onSaved: () => void
}

function ServerForm({ existing, onClose, onSaved }: ServerFormProps) {
  const classes = useStyles()
  const set = GQL.useMutation(MCP_SERVER_SET_MUTATION)

  const [values, setValues] = React.useState<ServerFormValues>(() =>
    existing
      ? {
          slug: existing.slug,
          title: existing.title,
          url: existing.url,
          hint: existing.hint ?? '',
          auth: existing.auth,
          authHeader: existing.authHeader ?? '',
          authPrefix: existing.authPrefix ?? '',
          secret: '',
        }
      : EMPTY_FORM,
  )
  const [pending, setPending] = React.useState(false)
  // Keyed by input path so the registry's own validation lands on the field it
  // is about, rather than as one opaque banner.
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)

  const field =
    (key: keyof ServerFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }))
      setErrors(({ [key]: _drop, ...rest }) => rest)
    }

  const submit = React.useCallback(async () => {
    if (pending) return
    setPending(true)
    setErrors({})
    setFormError(null)
    const header = values.auth === Types.McpServerAuth.HEADER
    const fields = {
      title: values.title,
      url: values.url,
      hint: values.hint.trim() || null,
      auth: values.auth,
      authHeader: header ? values.authHeader.trim() : null,
      authPrefix: header ? values.authPrefix || null : null,
      // Blank keeps the stored secret.
      secret: header && values.secret ? values.secret : null,
    }
    try {
      const res = await set({
        slug: values.slug.trim(),
        input: existing
          ? toInput(existing, fields)
          : { ...fields, enabled: false, trusted: false, forwardIdentity: false },
      })
      const result = res.admin.mcpServerSet
      switch (result.__typename) {
        case 'McpServerAdmin':
          onSaved()
          return
        case 'InvalidInput': {
          const byField = result.errors.map(
            (e) => [e.path?.split('.').pop() ?? 'slug', e.message] as const,
          )
          setErrors(Object.fromEntries(byField))
          const unplaced = byField.filter(([k]) => !(k in values))
          if (unplaced.length) setFormError(unplaced.map(([, m]) => m).join('; '))
          return
        }
        case 'OperationError':
          setFormError(result.message)
          return
        default:
          setFormError('Unexpected response from the registry')
      }
    } catch (e) {
      Sentry.captureException(e)
      setFormError(`Couldn't save: ${e}`)
    } finally {
      setPending(false)
    }
  }, [pending, set, values, existing, onSaved])

  return (
    <div className={classes.form}>
      <div className={classes.formRow}>
        <M.TextField
          label="Identifier"
          value={values.slug}
          onChange={field('slug')}
          disabled={pending || !!existing}
          error={!!errors.slug}
          helperText={
            errors.slug ??
            (existing
              ? 'Fixed once created — the assistant prefixes this server’s tool names with it.'
              : 'Lowercase letters, digits and hyphens, up to 24. Prefixes this server’s tool names.')
          }
          size="small"
          inputProps={{ 'aria-label': 'Server identifier' }}
        />
        <M.TextField
          label="Name"
          value={values.title}
          onChange={field('title')}
          disabled={pending}
          error={!!errors.title}
          helperText={errors.title ?? 'Shown to users and to the assistant.'}
          size="small"
          inputProps={{ 'aria-label': 'Server name' }}
        />
      </div>

      <M.TextField
        label="Endpoint"
        placeholder="https://mcp.internal.example.com/mcp"
        value={values.url}
        onChange={field('url')}
        disabled={pending}
        error={!!errors.url}
        helperText={
          errors.url ??
          'Must be https. The registry calls it on users’ behalf, so it has to be reachable from this stack.'
        }
        size="small"
        fullWidth
        inputProps={{ 'aria-label': 'Server endpoint URL' }}
      />

      <M.TextField
        label="What it is for"
        placeholder="Submits and monitors jobs on the internal GPU cluster."
        value={values.hint}
        onChange={field('hint')}
        disabled={pending}
        error={!!errors.hint}
        helperText={
          errors.hint ?? 'Optional. Tells the assistant when this server is relevant.'
        }
        size="small"
        fullWidth
        multiline
        inputProps={{ 'aria-label': 'What this server is for' }}
      />

      <M.TextField
        select
        label="Authentication"
        value={values.auth}
        onChange={field('auth')}
        disabled={pending}
        helperText="The credential stays in the registry; users’ browsers never see it."
        size="small"
        SelectProps={{ native: true }}
        inputProps={{ 'aria-label': 'Authentication' }}
      >
        <option value={Types.McpServerAuth.NONE}>None</option>
        <option value={Types.McpServerAuth.HEADER}>Secret in a request header</option>
      </M.TextField>

      {values.auth === Types.McpServerAuth.HEADER && (
        <div className={classes.formRow}>
          <M.TextField
            label="Header"
            placeholder="Authorization"
            value={values.authHeader}
            onChange={field('authHeader')}
            disabled={pending}
            error={!!errors.authHeader}
            helperText={errors.authHeader}
            size="small"
            inputProps={{ 'aria-label': 'Header name' }}
          />
          <M.TextField
            label="Prefix"
            placeholder="Bearer "
            value={values.authPrefix}
            onChange={field('authPrefix')}
            disabled={pending}
            error={!!errors.authPrefix}
            helperText={errors.authPrefix ?? 'Optional, sent before the secret.'}
            size="small"
            inputProps={{ 'aria-label': 'Header value prefix' }}
          />
          <M.TextField
            label="Secret"
            type="password"
            autoComplete="new-password"
            placeholder={existing?.hasSecret ? 'stored' : ''}
            value={values.secret}
            onChange={field('secret')}
            disabled={pending}
            error={!!errors.secret}
            helperText={
              errors.secret ??
              (existing?.hasSecret
                ? 'Stored. Leave blank to keep it; a new endpoint host clears it.'
                : 'Write-only: it cannot be read back.')
            }
            size="small"
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'Secret' }}
          />
        </div>
      )}

      {formError && (
        <M.Typography className={classes.error} role="alert">
          {formError}
        </M.Typography>
      )}

      <div className={classes.actions}>
        <M.Button onClick={onClose} size="small" disabled={pending}>
          Cancel
        </M.Button>
        <M.Button
          onClick={submit}
          size="small"
          variant="contained"
          color="primary"
          disabled={pending}
        >
          {existing ? 'Save' : 'Register'}
        </M.Button>
        {pending && <M.CircularProgress size={24} />}
      </div>
    </div>
  )
}

interface ServerRowProps {
  server: Server
  onChanged: () => void
}

function ServerRow({ server, onChanged }: ServerRowProps) {
  const classes = useStyles()
  const { push: notify } = Notifications.use()
  const set = GQL.useMutation(MCP_SERVER_SET_MUTATION)
  const remove = GQL.useMutation(MCP_SERVER_REMOVE_MUTATION)

  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const { probe, probing, check } = useProbe(server.slug)

  const update = React.useCallback(
    async (overrides: Partial<Types.McpServerInput>) => {
      if (busy) return
      setBusy(true)
      try {
        const res = await set({ slug: server.slug, input: toInput(server, overrides) })
        const result = res.admin.mcpServerSet
        if (result.__typename !== 'McpServerAdmin') {
          notify(
            result.__typename === 'InvalidInput'
              ? `Couldn't update ${server.title}: ${result.errors.map((e) => e.message).join('; ')}`
              : `Couldn't update ${server.title}: ${result.message}`,
          )
        }
        onChanged()
      } catch (e) {
        Sentry.captureException(e)
        notify(`Couldn't update ${server.title}: ${e}`)
      } finally {
        setBusy(false)
      }
    },
    [busy, notify, onChanged, server, set],
  )

  const doRemove = React.useCallback(async () => {
    if (busy) return
    // XXX: replace with a MUI dialog, matching NavLinkEditor's own note.
    // eslint-disable-next-line no-restricted-globals, no-alert
    if (!window.confirm(`Remove ${server.title} from the registry?`)) return
    setBusy(true)
    try {
      const res = await remove({ slug: server.slug })
      const result = res.admin.mcpServerRemove
      if (result.__typename !== 'Ok') {
        notify(
          result.__typename === 'InvalidInput'
            ? `Couldn't remove ${server.title}: ${result.errors.map((e) => e.message).join('; ')}`
            : `Couldn't remove ${server.title}: ${result.message}`,
        )
      }
      onChanged()
    } catch (e) {
      Sentry.captureException(e)
      notify(`Couldn't remove ${server.title}: ${e}`)
    } finally {
      setBusy(false)
    }
  }, [busy, notify, onChanged, remove, server])

  if (editing) {
    return (
      <ServerForm
        existing={server}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          onChanged()
        }}
      />
    )
  }

  return (
    <div className={classes.row}>
      <div className={classes.rowBody}>
        <div className={classes.heading}>
          <M.Typography variant="subtitle2">{server.title}</M.Typography>
          <M.Chip
            size="small"
            label={server.enabled ? 'offered to users' : 'registered, not offered'}
            variant="outlined"
          />
        </div>
        <M.Typography className={classes.endpoint} color="textSecondary">
          {server.url}
        </M.Typography>
        {server.hint && (
          <M.Typography className={classes.note} variant="body2" color="textSecondary">
            {server.hint}
          </M.Typography>
        )}
        <M.Typography variant="caption" color="textSecondary" component="p">
          Tools appear to the assistant as <code>{server.slug}__*</code>.{' '}
          {server.auth === Types.McpServerAuth.HEADER
            ? `The registry sends ${server.hasSecret ? 'a stored' : 'no'} secret in ${server.authHeader}.`
            : 'No credential is sent.'}
        </M.Typography>
        {probe && <ProbeBlock result={probe} slug={server.slug} />}
      </div>

      <div>
        <M.FormControlLabel
          control={
            <M.Switch
              checked={server.enabled}
              onChange={(_e, enabled) => update({ enabled })}
              disabled={busy}
              size="small"
            />
          }
          label="Enabled"
        />
        <M.FormControlLabel
          control={
            <M.Switch
              checked={server.trusted}
              onChange={(_e, trusted) => update({ trusted })}
              disabled={busy}
              size="small"
            />
          }
          label="Trusted"
        />
        <M.FormHelperText>
          Untrusted: the assistant treats its tool output as data, never instructions.
        </M.FormHelperText>
        <M.Button size="small" onClick={check} disabled={probing}>
          {probing ? 'Probing…' : 'Probe'}
        </M.Button>
        <M.Button size="small" onClick={() => setEditing(true)} disabled={busy}>
          Edit
        </M.Button>
        <M.Button size="small" onClick={doRemove} disabled={busy}>
          Remove
        </M.Button>
      </div>
    </div>
  )
}

export default function McpServerSettings() {
  const classes = useStyles()
  const query = GQL.useQuery(MCP_SERVERS_QUERY)
  const [adding, setAdding] = React.useState(false)

  const refetch = React.useCallback(
    () => query.run({ requestPolicy: 'network-only' }),
    [query],
  )

  return (
    <>
      <M.Typography variant="body2" color="textSecondary">
        MCP servers Qurator may use. The registry relays every call, so a server’s
        credential never reaches a browser. Enabling a server lets it see what users ask
        Qurator about their data. Disabling or removing one takes effect at once; other
        changes reach Qurator on each user’s next page load.
      </M.Typography>

      {GQL.fold(query, {
        fetching: () => (
          <>
            <Skeleton width="60%" height={24} my="10px" />
            <Skeleton width="40%" height={20} mt="4px" />
          </>
        ),
        error: (e) => (
          <M.Typography className={classes.error} role="alert">
            Couldn’t load the MCP servers: {e.message}
          </M.Typography>
        ),
        data: (data) => {
          const servers = data.admin.mcpServers
          return (
            <>
              {!data.admin.mcpServersAvailable && (
                <M.Typography className={classes.error} role="status">
                  MCP servers are switched off on this stack (its QuratorMcpServers
                  parameter), so Qurator offers none and changes here cannot be saved.
                </M.Typography>
              )}
              {servers.length === 0 ? (
                <div className={classes.empty}>
                  No servers registered. Qurator uses Quilt’s own platform tools
                  regardless.
                </div>
              ) : (
                servers.map((s, i) => (
                  // Keyed by `updatedAt` too, so a saved edit drops a stale probe.
                  <React.Fragment key={`${s.slug}:${s.updatedAt}`}>
                    {i > 0 && <M.Divider />}
                    <ServerRow server={s} onChanged={refetch} />
                  </React.Fragment>
                ))
              )}
            </>
          )
        },
      })}

      {adding ? (
        <ServerForm
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            refetch()
          }}
        />
      ) : (
        <div className={classes.actions}>
          <M.Button size="small" variant="outlined" onClick={() => setAdding(true)}>
            Register a server
          </M.Button>
        </div>
      )}
    </>
  )
}
