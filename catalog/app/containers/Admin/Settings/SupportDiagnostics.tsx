import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import * as APIConnector from 'utils/APIConnector'

// The registry names the archive after the collection run, and support asks for
// that name when several bundles are in flight. Readable cross-origin only
// because the endpoint's CORS config exposes Content-Disposition.
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
  URL.revokeObjectURL(url)
}

interface Failure {
  severity: 'error' | 'warning' | 'info'
  message: string
}

// 503 means the stack's CloudFormation template predates the collector and 409
// that a collection is already running -- neither is a malfunction, so neither
// gets the red alert that would send an admin to file a bug.
const SEVERITIES: Record<number, Failure['severity']> = {
  503: 'info',
  409: 'warning',
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
        setFailure({
          severity: SEVERITIES[e.status] || 'error',
          message: e.json?.message || e.message,
        })
      } else {
        Sentry.captureException(e)
        setFailure({ severity: 'error', message: `Could not collect diagnostics: ${e}` })
      }
    } finally {
      setCollecting(false)
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
              Collecting&hellip; A large or unhealthy cluster takes longer; leaving this
              page cancels it.
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
