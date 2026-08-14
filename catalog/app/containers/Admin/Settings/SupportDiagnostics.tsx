import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import * as APIConnector from 'utils/APIConnector'

// Carries the run id, which support asks for when several bundles are in flight.
// Readable cross-origin only because the endpoint's CORS config exposes the header.
const FILENAME_RE = /filename="([^"]+)"/

const FALLBACK_FILENAME = 'quilt-support-diagnostics.zip'

function getFilename(response: Response): string {
  const match = FILENAME_RE.exec(response.headers.get('Content-Disposition') || '')
  return match?.[1] || FALLBACK_FILENAME
}

function saveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Not synchronously: clicking only queues the download, and revoking the URL
  // before the browser reads the blob cancels it in some of them.
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

interface Failure {
  severity: 'error' | 'warning' | 'info'
  message: string
}

// Keyed on the registry's error_code, never the HTTP status: this stack having no
// collector answers 503 and so does a registry that is merely cycling. Anything
// unrecognised -- including everything raised before the endpoint is reached, by the
// ALB or the nginx sidecar -- keeps the red alert.
const SEVERITIES: Record<string, Failure['severity']> = {
  NotAvailable: 'info',
  AlreadyRunning: 'warning',
}

// APIConnector puts raw text in `message` for a body that will not parse as JSON, so
// showing it would paste an ALB or nginx error page into the alert.
const GENERIC_FAILURE =
  'Could not collect diagnostics. The registry may be restarting or unreachable; try again in a few minutes.'

function describe(e: APIConnector.HTTPError): Failure {
  const code = e.json?.error_code
  if (!code) return { severity: 'error', message: GENERIC_FAILURE }
  return {
    severity: SEVERITIES[code] || 'error',
    message: e.json?.message || GENERIC_FAILURE,
  }
}

const useStyles = M.makeStyles((t) => ({
  actions: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(2),
  },
  progress: {
    marginLeft: t.spacing(2),
  },
  progressText: {
    color: t.palette.text.secondary,
    marginLeft: t.spacing(1),
  },
  failure: {
    marginTop: t.spacing(2),
  },
}))

export default function SupportDiagnostics() {
  const classes = useStyles()
  const req = APIConnector.use()

  const [collecting, setCollecting] = React.useState(false)
  const [failure, setFailure] = React.useState<Failure | null>(null)

  // Leaving Settings does not cancel the request -- the saga owns it, not this
  // component -- so the download still lands, which is the behaviour we want: the
  // collection has already run against a cluster that may be struggling, and throwing
  // the bundle away would make the admin pay for it twice. Only the state updates are
  // skipped, since React 17 warns on setState after unmount.
  const mounted = React.useRef(true)
  React.useEffect(() => () => void (mounted.current = false), [])

  const collect = React.useCallback(async () => {
    setCollecting(true)
    setFailure(null)
    try {
      const response: Response = await req({
        endpoint: '/admin/support-diagnostics',
        method: 'POST',
        // The response is an archive, and there is no request body to encode.
        json: false,
      })
      saveAs(await response.blob(), getFilename(response))
    } catch (e) {
      if (e instanceof APIConnector.HTTPError) {
        if (mounted.current) setFailure(describe(e))
      } else {
        Sentry.captureException(e)
        if (mounted.current) setFailure({ severity: 'error', message: GENERIC_FAILURE })
      }
    } finally {
      if (mounted.current) setCollecting(false)
    }
  }, [req])

  return (
    <>
      <M.Typography variant="body2">
        Collect a diagnostics bundle describing this stack&apos;s search cluster and
        infrastructure, for Quilt support to debug against. Nothing is sent anywhere: the
        bundle downloads to your computer, and the <code>manifest.json</code> inside it
        lists exactly what was collected, so you can review it before attaching it to a
        support request.
      </M.Typography>
      <div className={classes.actions}>
        <M.Button
          variant="contained"
          color="primary"
          onClick={collect}
          disabled={collecting}
        >
          Collect diagnostics
        </M.Button>
        {collecting && (
          <>
            <M.CircularProgress size={20} className={classes.progress} />
            <M.Typography variant="body2" className={classes.progressText}>
              Collecting&hellip; A large or unhealthy cluster takes longer. You can leave
              this page — the download still arrives — but closing the tab loses it.
            </M.Typography>
          </>
        )}
      </div>
      {failure && (
        <Lab.Alert severity={failure.severity} className={classes.failure}>
          {failure.message}
        </Lab.Alert>
      )}
    </>
  )
}
