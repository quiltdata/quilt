import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import * as SessionPackage from 'components/Assistant/Model/SessionPackage'
import Chat from 'components/Assistant/UI/Chat'
import * as InlinePresence from 'components/Assistant/UI/InlinePresence'
import Layout from 'components/Layout'
import * as NamedRoutes from 'utils/NamedRoutes'

import { title as toolTitle } from 'components/Assistant/Model/Tool'
import * as SessionSave from 'components/Assistant/Model/SessionSave'

type API = NonNullable<ReturnType<typeof Assistant.Model.useAssistantAPI>> & {
  save?: SessionSave.SessionSave
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    // Outgrows Layout's trailing flex spacer, so the chat owns the column's height.
    flex: '999 1 0',
    minHeight: 0,
    [t.breakpoints.down('sm')]: { flexDirection: 'column' },
  },
  chat: {
    borderRight: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexGrow: 1,
    minHeight: 0,
    minWidth: 0,
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: `${t.spacing(2)}px`,
    overflowY: 'auto',
    padding: t.spacing(2),
    width: 320,
    [t.breakpoints.only('sm')]: {
      borderTop: `1px solid ${t.palette.divider}`,
      maxHeight: '40%',
      width: 'auto',
    },
  },
  count: { color: t.palette.text.secondary },
  mono: {
    fontFamily: t.typography.monospace?.fontFamily ?? 'monospace',
    overflowWrap: 'anywhere',
  },
  refs: {
    margin: 0,
    paddingLeft: t.spacing(2),
    '& li': { overflowWrap: 'anywhere', marginBottom: t.spacing(0.5) },
  },
}))

function RefLink({ r }: { r: SessionPackage.Reference }) {
  const { urls } = NamedRoutes.use()
  const [to, label] =
    r.kind === 'package'
      ? [urls.bucketPackageDetail(r.bucket, r.name), r.name]
      : r.kind === 'object'
        ? [urls.bucketFile(r.bucket, r.key), `${r.bucket}/${r.key}`]
        : [urls.bucketOverview(r.bucket), r.bucket]
  return (
    <M.Link component={Link} to={to}>
      {label}
    </M.Link>
  )
}

function ContextPane({ api, onCatalog }: { api: API; onCatalog: () => void }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { events } = api.state
  const refs = React.useMemo(() => SessionPackage.references(events), [events])
  const used = React.useMemo(() => {
    const counts = new Map<string, { ok: number; failed: number }>()
    events.forEach((e) => {
      if (e._tag !== 'ToolUse' || e.discarded) return
      const c = counts.get(e.name) ?? { ok: 0, failed: 0 }
      if (e.result.status === 'success') c.ok += 1
      else c.failed += 1
      counts.set(e.name, c)
    })
    return Array.from(counts)
  }, [events])
  const saved = api.save?.status._tag === 'saved' ? api.save.status : null
  return (
    <aside className={classes.pane} aria-label="Session context">
      <M.Button variant="outlined" size="small" onClick={onCatalog}>
        Back to catalog view
      </M.Button>
      <div>
        <M.Typography variant="subtitle2" gutterBottom>
          Touched in this session
        </M.Typography>
        {refs.length ? (
          <ul className={classes.refs}>
            {refs.map((r) => (
              <li key={SessionPackage.referenceId(r)}>
                <RefLink r={r} />
              </li>
            ))}
          </ul>
        ) : (
          <M.Typography variant="body2" color="textSecondary">
            Packages, files and buckets Qurator reads or writes show up here.
          </M.Typography>
        )}
      </div>
      <div>
        <M.Typography variant="subtitle2" gutterBottom>
          Tools used
        </M.Typography>
        {used.length ? (
          <ul className={classes.refs}>
            {used.map(([name, c]) => (
              <li key={name}>
                {toolTitle(name)}
                <span className={classes.count}>
                  {c.ok ? ` ×${c.ok}` : ''}
                  {c.failed ? ` · ${c.failed} failed` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <M.Typography variant="body2" color="textSecondary">
            Each tool Qurator runs is listed here.
          </M.Typography>
        )}
      </div>
      <div>
        <M.Typography variant="subtitle2" gutterBottom>
          Saved
        </M.Typography>
        {saved ? (
          <M.Link
            component={Link}
            className={classes.mono}
            to={urls.bucketPackageTree(saved.bucket, saved.name, saved.hash)}
          >
            {saved.name}@{saved.hash.slice(0, 8)}
          </M.Link>
        ) : (
          <M.Typography variant="body2" color="textSecondary">
            Save the session as a package from the + menu.
          </M.Typography>
        )}
      </div>
    </aside>
  )
}

function Workspace({
  api,
}: {
  api: NonNullable<ReturnType<typeof Assistant.Model.useAssistantAPI>>
}) {
  const classes = useStyles()
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  // Back to wherever the user switched modes from; a cold open lands on home.
  const toCatalog = React.useCallback(
    () => (history.length > 1 ? history.goBack() : history.push(urls.home())),
    [history, urls],
  )
  const save = SessionSave.useSessionSave(api)
  const phone = M.useMediaQuery(M.useTheme().breakpoints.down('xs'))
  return (
    <div className={classes.root}>
      {/* Registered presence drops the docked panel: one conversation, one place. */}
      <InlinePresence.Provide value>
        <div className={classes.chat}>
          <Chat {...api} composer="compact" save={save} onClose={toCatalog} />
        </div>
      </InlinePresence.Provide>
      {!phone && <ContextPane api={{ ...api, save }} onCatalog={toCatalog} />}
    </div>
  )
}

export default function QuratorMode() {
  const api = Assistant.Model.useAssistantAPI()
  if (!api) {
    return (
      <Layout>
        <M.Typography>Qurator isn&apos;t enabled on this stack.</M.Typography>
      </Layout>
    )
  }
  return <Layout flush pre={<Workspace api={api} />} />
}
