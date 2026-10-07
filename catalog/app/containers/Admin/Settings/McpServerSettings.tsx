import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as redux from 'react-redux'

import * as AuthSelectors from 'containers/Auth/selectors'

import { McpServers } from 'components/Assistant/Model'

const EXAMPLE: McpServers.Server = {
  slug: 'deepwiki',
  title: 'DeepWiki',
  url: 'https://mcp.deepwiki.com/mcp',
  hint: 'Answers questions about public GitHub repositories from their generated docs.',
  enabled: false,
}

const EMPTY_FORM = {
  slug: '',
  title: '',
  url: '',
  hint: '',
  headerName: '',
  headerValue: '',
}

type Probe =
  | { _tag: 'running' }
  | { _tag: 'ok'; tools: { name: string; description?: string; readOnly?: boolean }[] }
  | { _tag: 'failed'; message: string }

const useStyles = M.makeStyles((t) => ({
  root: { display: 'flex', flexDirection: 'column', gap: t.spacing(2) },
  row: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    padding: t.spacing(1, 1.5),
  },
  head: { alignItems: 'center', display: 'flex', gap: t.spacing(1) },
  title: { ...t.typography.subtitle2, flex: 1, minWidth: 0 },
  url: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    fontFamily: t.typography.monospace?.fontFamily ?? 'monospace',
    overflowWrap: 'anywhere',
  },
  tools: {
    ...t.typography.body2,
    margin: t.spacing(1, 0, 0),
    paddingLeft: t.spacing(2.5),
  },
  form: { display: 'grid', gap: t.spacing(1.5), gridTemplateColumns: '1fr 1fr' },
  wide: { gridColumn: '1 / -1' },
  actions: { alignItems: 'center', display: 'flex', gap: t.spacing(1) },
}))

function ServerRow({
  server,
  onToggle,
  onRemove,
}: {
  server: McpServers.Server
  onToggle: (enabled: boolean) => void
  onRemove: () => void
}) {
  const classes = useStyles()
  const [probe, setProbe] = React.useState<Probe | null>(null)
  const test = React.useCallback(() => {
    setProbe({ _tag: 'running' })
    const backend = McpServers.backend(server)
    Eff.Effect.runPromise(
      backend.initialize().pipe(
        Eff.Effect.zipRight(backend.listTools()),
        Eff.Effect.timeout('15 seconds'),
        Eff.Effect.match({
          onFailure: (e): Probe => ({
            _tag: 'failed',
            message: `${e._tag}: ${e.message}`,
          }),
          onSuccess: (tools): Probe => ({ _tag: 'ok', tools: [...tools] }),
        }),
      ),
    )
      .then(setProbe)
      .catch((e) => setProbe({ _tag: 'failed', message: String(e) }))
  }, [server])
  return (
    <div className={classes.row}>
      <div className={classes.head}>
        <span className={classes.title}>
          {server.title} <code>{server.slug}</code>
        </span>
        {server.headerName && (
          <M.Chip size="small" label={`header: ${server.headerName}`} />
        )}
        <M.Button size="small" onClick={test} disabled={probe?._tag === 'running'}>
          Test
        </M.Button>
        <M.FormControlLabel
          control={
            <M.Switch checked={server.enabled} onChange={(_e, v) => onToggle(v)} />
          }
          label={server.enabled ? 'On' : 'Off'}
        />
        <M.IconButton size="small" onClick={onRemove} aria-label="Remove">
          <M.Icon fontSize="small">delete</M.Icon>
        </M.IconButton>
      </div>
      <div className={classes.url}>{server.url}</div>
      {probe?._tag === 'running' && <M.LinearProgress />}
      {probe?._tag === 'failed' && (
        <M.Typography variant="body2" color="error">
          Could not connect ({probe.message}). A browser call needs the server to allow
          this catalog's origin (CORS).
        </M.Typography>
      )}
      {probe?._tag === 'ok' && (
        <ul className={classes.tools}>
          {probe.tools.map((tool) => (
            <li key={tool.name}>
              <code>{tool.name}</code>
              {tool.readOnly && ' · read-only'}
              {tool.description && ` — ${tool.description.split('\n')[0]}`}
            </li>
          ))}
          {!probe.tools.length && <li>No tools advertised.</li>}
        </ul>
      )}
    </div>
  )
}

export default function McpServerSettings() {
  const classes = useStyles()
  const username: string = redux.useSelector(AuthSelectors.username) || ''
  const [servers, setServers] = React.useState(() => McpServers.read(username))
  const [dirty, setDirty] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [error, setError] = React.useState<string | null>(null)

  const save = React.useCallback(
    (next: McpServers.Server[]) => {
      McpServers.write(username, next)
      setServers(next)
      setDirty(true)
    },
    [username],
  )

  const add = React.useCallback(
    (s: McpServers.Server) => {
      const problem = McpServers.validate(s, servers)
      setError(problem)
      if (problem) return
      save([...servers, s])
      setForm(EMPTY_FORM)
    },
    [save, servers],
  )

  const field = (name: keyof typeof EMPTY_FORM, label: string, wide = false) => (
    <M.TextField
      className={wide ? classes.wide : undefined}
      label={label}
      size="small"
      variant="outlined"
      type={name === 'headerValue' ? 'password' : undefined}
      // Keep password managers from filling the catalog login into these.
      autoComplete={name === 'headerValue' ? 'new-password' : 'off'}
      value={form[name]}
      onChange={(e) => setForm({ ...form, [name]: e.target.value })}
    />
  )

  return (
    <div className={classes.root}>
      <Lab.Alert severity="info">
        Prototype. This list is kept in <b>this browser only</b> and Qurator calls these
        servers straight from the browser. In the proposed design an admin keeps it in the
        registry, header secrets are stored in Secrets Manager, and the registry relays
        every call so no browser sees the server's URL or secret.
      </Lab.Alert>

      {servers.map((s) => (
        <ServerRow
          key={s.slug}
          server={s}
          onToggle={(enabled) =>
            save(servers.map((o) => (o.slug === s.slug ? { ...o, enabled } : o)))
          }
          onRemove={() => save(servers.filter((o) => o.slug !== s.slug))}
        />
      ))}
      {!servers.length && (
        <M.Typography variant="body2" color="textSecondary">
          No extra servers. Qurator uses the Quilt Platform tools only.
        </M.Typography>
      )}

      <div className={classes.form}>
        {field('title', 'Title')}
        {field('slug', 'Id (tool prefix)')}
        {field('url', 'MCP endpoint URL (https)', true)}
        {field('hint', 'What it is for (shown to the model)', true)}
        {field('headerName', 'Auth header name (optional)')}
        {field('headerValue', 'Auth header value (optional)')}
      </div>
      {error && (
        <M.Typography variant="body2" color="error">
          {error}
        </M.Typography>
      )}
      <div className={classes.actions}>
        <M.Button
          variant="outlined"
          onClick={() =>
            add({
              slug: form.slug.trim(),
              title: form.title.trim(),
              url: form.url.trim(),
              hint: form.hint.trim() || undefined,
              headerName: form.headerName.trim() || undefined,
              headerValue: form.headerValue || undefined,
              enabled: false,
            })
          }
        >
          Add server
        </M.Button>
        {!servers.some((s) => s.slug === EXAMPLE.slug) && (
          <M.Button onClick={() => add(EXAMPLE)}>Add example: DeepWiki</M.Button>
        )}
        {dirty && (
          <M.Button color="primary" onClick={() => window.location.reload()}>
            Reload to apply in Qurator
          </M.Button>
        )}
      </div>
    </div>
  )
}
