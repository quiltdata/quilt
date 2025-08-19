import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import ClearIcon from '@material-ui/icons/Clear'
import DeleteIcon from '@material-ui/icons/Delete'
import GetAppIcon from '@material-ui/icons/GetApp'
import SearchIcon from '@material-ui/icons/Search'

import JsonDisplay from 'components/JsonDisplay'

import * as Model from '../../Model'
import { discoverTextModels, ModelCheckResult } from './ListModels'

const useModelIdOverrideStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
}))

type ModelIdOverrideProps = Model.Assistant.API['devTools']['modelIdOverride']

function ModelSelectorDialog({
  open,
  onClose,
  onSelect,
  region,
}: {
  open: boolean
  onClose: () => void
  onSelect: (modelId: string) => void
  region: string
}) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ModelCheckResult[]>([])
  const [filter, setFilter] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    discoverTextModels(region)
      .then((r) => {
        if (!cancelled) setRows(r)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, region])

  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          r.modelId.toLowerCase().includes(filter.toLowerCase()) ||
          r.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.provider.toLowerCase().includes(filter.toLowerCase()),
      ),
    [rows, filter],
  )

  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <M.DialogTitle>Select Bedrock Model</M.DialogTitle>
      <M.DialogContent dividers>
        <M.Box display="flex" alignItems="center" mb={2} gap={1} justifyContent="space-between">
          <M.TextField
            label="Filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            size="small"
            variant="outlined"
          />
          <M.Typography variant="caption" color="textSecondary">
            Region: {region}
          </M.Typography>
        </M.Box>
        {loading && <M.LinearProgress />}
        {error && (
          <M.Box mb={1}>
            <M.Typography color="error" variant="body2">
              {error}
            </M.Typography>
          </M.Box>
        )}
        <M.Table size="small" stickyHeader>
          <M.TableHead>
            <M.TableRow>
              <M.TableCell>Status</M.TableCell>
              <M.TableCell>Model ID</M.TableCell>
              <M.TableCell>Name</M.TableCell>
              <M.TableCell>Provider</M.TableCell>
              <M.TableCell>Detail</M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {filtered.map((r) => {
              const selectable = r.status === 'ENABLED'
              return (
                <M.TableRow
                  hover
                  key={r.modelId}
                  onClick={() => {
                    if (selectable) {
                      onSelect(r.modelId)
                      onClose()
                    }
                  }}
                  style={{ cursor: selectable ? 'pointer' : 'default', opacity: selectable ? 1 : 0.5 }}
                >
                  <M.TableCell>
                    <M.Chip
                      size="small"
                      label={r.status}
                      color={
                        r.status === 'ENABLED'
                          ? 'primary'
                          : r.status === 'NO_ACCESS'
                          ? 'secondary'
                          : 'default'
                      }
                      variant={r.status === 'ENABLED' ? 'default' : 'outlined'}
                    />
                  </M.TableCell>
                  <M.TableCell style={{ fontFamily: 'monospace' }}>{r.modelId}</M.TableCell>
                  <M.TableCell>{r.name}</M.TableCell>
                  <M.TableCell>{r.provider}</M.TableCell>
                  <M.TableCell>{r.detail}</M.TableCell>
                </M.TableRow>
              )
            })}
            {!loading && filtered.length === 0 && (
              <M.TableRow>
                <M.TableCell colSpan={5}>
                  <M.Typography align="center" variant="body2">
                    No models
                  </M.Typography>
                </M.TableCell>
              </M.TableRow>
            )}
          </M.TableBody>
        </M.Table>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

function ModelIdOverride({ value, setValue }: ModelIdOverrideProps) {
  const classes = useModelIdOverrideStyles()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [region, setRegion] = React.useState<string>(process.env.AWS_REGION || 'us-east-1')

  const handleModelIdChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value)
    },
    [setValue],
  )

  const handleClear = React.useCallback(() => setValue(''), [setValue])

  return (
    <div className={classes.root}>
      <M.Box display="flex" gap={1}>
        <M.TextField
          label="Bedrock Model ID"
          placeholder={Model.Assistant.DEFAULT_MODEL_ID}
          value={value}
          onChange={handleModelIdChange}
          fullWidth
          helperText="Leave empty to use default"
          InputLabelProps={{ shrink: true }}
          InputProps={{
            endAdornment: value ? (
              <M.InputAdornment position="end">
                <M.IconButton
                  aria-label="Clear model ID override"
                  onClick={handleClear}
                  edge="end"
                  size="small"
                >
                  <M.Tooltip arrow title="Clear model ID override">
                    <ClearIcon />
                  </M.Tooltip>
                </M.IconButton>
              </M.InputAdornment>
            ) : null,
          }}
        />
        <M.TextField
          label="Region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          style={{ width: 140 }}
          size="small"
          InputLabelProps={{ shrink: true }}
        />
        <M.Button
          variant="outlined"
          startIcon={<SearchIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Browse
        </M.Button>
      </M.Box>
      <ModelSelectorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={(id) => setValue(id)}
        region={region}
      />
    </div>
  )
}

const useRecordingControlsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
  label: {
    ...t.typography.body2,
    flexGrow: 1,
    padding: t.spacing(0, 2),
  },
}))

type RecordingControlsProps = Model.Assistant.API['devTools']['recording']

function RecordingControls({ enabled, log, enable, clear }: RecordingControlsProps) {
  const classes = useRecordingControlsStyles()

  const handleToggleRecording = React.useCallback(() => {
    enable(!enabled)
  }, [enabled, enable])

  const handleDownload = React.useCallback(() => {
    const data = `[\n${log.join(',\n')}\n]`
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qurator-session-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [log])

  return (
    <div className={classes.root}>
      <M.Button
        onClick={handleToggleRecording}
        variant="contained"
        color="primary"
        size="small"
      >
        {enabled ? 'Stop' : 'Start'} Recording
      </M.Button>

      {(enabled || log.length > 0) && (
        <div className={classes.label}>
          {log.length > 0 ? `${log.length} item(s) recorded` : 'Recording...'}
        </div>
      )}

      {log.length > 0 && (
        <>
          <M.Button
            onClick={handleDownload}
            size="small"
            variant="outlined"
            startIcon={<GetAppIcon />}
          >
            Download Log
          </M.Button>
          <M.Button
            onClick={clear}
            size="small"
            variant="outlined"
            startIcon={<DeleteIcon />}
          >
            Clear Log
          </M.Button>
        </>
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  heading: {
    ...t.typography.h5,
    borderBottom: `1px solid ${t.palette.divider}`,
    lineHeight: '64px',
    paddingLeft: t.spacing(2),
  },
  contents: {
    flexGrow: 1,
    overflow: 'auto',
  },
  json: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
}))

interface DevToolsProps {
  state: Model.Assistant.API['state']
  modelIdOverride: Model.Assistant.API['devTools']['modelIdOverride']
  recording: Model.Assistant.API['devTools']['recording']
}

export default function DevTools({ state, modelIdOverride, recording }: DevToolsProps) {
  const classes = useStyles()

  const context = Model.Context.useAggregatedContext()

  const prompt = React.useMemo(
    () =>
      Eff.Effect.runSync(
        Model.Conversation.constructPrompt(
          state.events.filter((e) => !e.discarded),
          context,
        ),
      ),
    [state, context],
  )

  return (
    <section className={classes.root}>
      <h1 className={classes.heading}>Qurator Developer Tools</h1>
      <div className={classes.contents}>
        <ModelIdOverride {...modelIdOverride} />
        <M.Divider />
        <RecordingControls {...recording} />
        <M.Divider />
        <JsonDisplay className={classes.json} name="Context" value={context} />
        <JsonDisplay className={classes.json} name="State" value={state} />
        <JsonDisplay className={classes.json} name="Prompt" value={prompt} />
      </div>
    </section>
  )
}
