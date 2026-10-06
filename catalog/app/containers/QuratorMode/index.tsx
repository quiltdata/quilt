import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import * as SessionPackage from 'components/Assistant/Model/SessionPackage'
import Chat from 'components/Assistant/UI/Chat'
import * as InlinePresence from 'components/Assistant/UI/InlinePresence'
import Layout from 'components/Layout'
import * as NamedRoutes from 'utils/NamedRoutes'

import Save from './Save'

type API = NonNullable<ReturnType<typeof Assistant.Model.useAssistantAPI>>

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    // Outgrows Layout's trailing flex spacer, so the chat owns the column's height.
    flex: '999 1 0',
    minHeight: 0,
  },
  chat: {
    borderRight: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexGrow: 1,
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
    // A phone gets the full-page chat alone; the PWA shell is that surface.
    [t.breakpoints.down('sm')]: { display: 'none' },
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
  const { events } = api.state
  const refs = React.useMemo(() => SessionPackage.references(events), [events])
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
      <M.Divider />
      <Save api={api} />
    </aside>
  )
}

export default function QuratorMode() {
  const classes = useStyles()
  const api = Assistant.Model.useAssistantAPI()
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  // Back to wherever the user switched modes from; a cold open lands on home.
  const toCatalog = React.useCallback(
    () => (history.length > 1 ? history.goBack() : history.push(urls.home())),
    [history, urls],
  )

  if (!api) {
    return (
      <Layout>
        <M.Typography>Qurator isn&apos;t enabled on this stack.</M.Typography>
      </Layout>
    )
  }

  return (
    <Layout
      flush
      pre={
        <div className={classes.root}>
          {/* Registered presence drops the docked panel: one conversation, one place. */}
          <InlinePresence.Provide value>
            <div className={classes.chat}>
              <Chat
                state={api.state}
                dispatch={api.dispatch}
                devTools={api.devTools}
                connectors={api.connectors}
                instructions={api.instructions}
                model={api.model}
                busy={api.busy}
                onClose={toCatalog}
              />
            </div>
          </InlinePresence.Provide>
          <ContextPane api={api} onCatalog={toCatalog} />
        </div>
      }
    />
  )
}
