import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as Format from 'utils/format'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import * as Model from 'containers/Queries/Athena/model/utils'

import FormatBadge from './FormatBadge'
import * as requests from './requests'

const useCoordinatesStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  code: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    fontFamily: t.typography.monospace.fontFamily,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

interface CoordinatesProps {
  catalog: string
  database: string
  table: string
}

// The fully-qualified Athena name is always visible and copyable: the UI never
// lies about query coordinates (honest-coordinates principle).
function Coordinates({ catalog, database, table }: CoordinatesProps) {
  const classes = useCoordinatesStyles()
  const { push } = Notifications.use()
  const fqn = `${catalog}.${database}.${table}`
  const handleCopy = React.useCallback(() => {
    copyToClipboard(`"${catalog}"."${database}"."${table}"`)
    push('Fully-qualified table name copied to clipboard')
  }, [catalog, database, table, push])
  return (
    <div className={classes.root}>
      <span className={classes.code} title={fqn}>
        {fqn}
      </span>
      <M.Tooltip title="Copy fully-qualified name">
        <M.IconButton onClick={handleCopy} size="small">
          <M.Icon fontSize="inherit">file_copy</M.Icon>
        </M.IconButton>
      </M.Tooltip>
    </div>
  )
}

const useContextStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(1),
  },
  title: {
    ...t.typography.h6,
    flexGrow: 1,
  },
  row: {
    marginBottom: t.spacing(1),
  },
  label: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
  },
  value: {
    ...t.typography.body2,
  },
  emptyValue: {
    ...t.typography.body2,
    color: t.palette.text.disabled,
    fontStyle: 'italic',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    marginTop: t.spacing(0.5),
  },
  field: {
    marginBottom: t.spacing(2),
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: t.spacing(1),
  },
}))

interface ContextEditorProps {
  context: requests.TableContext
  saving: boolean
  onSave: (next: requests.TableContext) => Promise<void>
  onCancel: () => void
}

function ContextEditor({ context, saving, onSave, onCancel }: ContextEditorProps) {
  const classes = useContextStyles()
  const [description, setDescription] = React.useState(context.description)
  const [rowMeaning, setRowMeaning] = React.useState(context.rowMeaning)
  const [questions, setQuestions] = React.useState(context.exampleQuestions.join('\n'))
  const handleSave = React.useCallback(() => {
    onSave({
      ...context,
      description: description.trim(),
      rowMeaning: rowMeaning.trim(),
      exampleQuestions: questions
        .split('\n')
        .map((q) => q.trim())
        .filter(Boolean),
    })
  }, [onSave, context, description, rowMeaning, questions])
  return (
    <>
      <M.TextField
        className={classes.field}
        fullWidth
        label="What it is"
        multiline
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. Product analytics events exported nightly from Mixpanel"
        value={description}
        variant="outlined"
      />
      <M.TextField
        className={classes.field}
        fullWidth
        label="What a row means"
        onChange={(e) => setRowMeaning(e.target.value)}
        placeholder="e.g. One row = one tracked event"
        value={rowMeaning}
        variant="outlined"
      />
      <M.TextField
        className={classes.field}
        fullWidth
        helperText="One question per line"
        label="Questions this table answers"
        multiline
        rows={2}
        onChange={(e) => setQuestions(e.target.value)}
        placeholder="e.g. Which customers accrued the most data in October?"
        value={questions}
        variant="outlined"
      />
      <div className={classes.actions}>
        <M.Button disabled={saving} onClick={onCancel}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          disabled={saving}
          onClick={handleSave}
          variant="contained"
        >
          {saving ? 'Saving…' : 'Save context'}
        </M.Button>
      </div>
    </>
  )
}

interface ContextSectionProps {
  controller: ReturnType<typeof requests.useTableContext>
}

// The Quilt context zone: always rendered, even empty — an empty state that
// invites editing ("Glue carries schema; Quilt carries meaning").
function ContextSection({ controller }: ContextSectionProps) {
  const classes = useContextStyles()
  const [editing, setEditing] = React.useState(false)
  const { push } = Notifications.use()
  const { value, save, saving } = controller

  const handleSave = React.useCallback(
    async (next: requests.TableContext) => {
      try {
        await save(next)
        setEditing(false)
        push('Table context saved')
      } catch (e) {
        push(`Could not save table context: ${e instanceof Error ? e.message : e}`)
      }
    },
    [save, push],
  )

  if (Model.isError(value)) {
    return (
      <M.Paper className={classes.root}>
        <Lab.Alert severity="warning">
          Could not load Quilt context metadata: {value.message}
        </Lab.Alert>
      </M.Paper>
    )
  }

  if (!Model.hasData(value)) {
    return (
      <M.Paper className={classes.root}>
        <Skeleton height={96} animate />
      </M.Paper>
    )
  }

  const empty = !value.description && !value.rowMeaning && !value.exampleQuestions.length

  return (
    <M.Paper className={classes.root}>
      <div className={classes.header}>
        <div className={classes.title}>Context</div>
        {!editing && (
          <M.Button
            color="primary"
            onClick={() => setEditing(true)}
            size="small"
            startIcon={<M.Icon>edit</M.Icon>}
          >
            Edit
          </M.Button>
        )}
      </div>
      {editing ? (
        <ContextEditor
          context={value}
          onCancel={() => setEditing(false)}
          onSave={handleSave}
          saving={saving}
        />
      ) : empty ? (
        <M.Typography className={classes.emptyValue}>
          Add context so agents (and humans) know when to use this table.
        </M.Typography>
      ) : (
        <>
          <div className={classes.row}>
            <div className={classes.label}>What it is</div>
            <div className={value.description ? classes.value : classes.emptyValue}>
              {value.description || 'Not described yet'}
            </div>
          </div>
          <div className={classes.row}>
            <div className={classes.label}>What a row means</div>
            <div className={value.rowMeaning ? classes.value : classes.emptyValue}>
              {value.rowMeaning || 'Not described yet'}
            </div>
          </div>
          <div className={classes.row}>
            <div className={classes.label}>Questions this table answers</div>
            {value.exampleQuestions.length ? (
              <div className={classes.chips}>
                {value.exampleQuestions.map((q) => (
                  <M.Chip key={q} label={q} size="small" variant="outlined" />
                ))}
              </div>
            ) : (
              <div className={classes.emptyValue}>None yet</div>
            )}
          </div>
        </>
      )}
    </M.Paper>
  )
}

const useSchemaStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
  title: {
    ...t.typography.h6,
    marginBottom: t.spacing(1),
  },
  note: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    marginLeft: t.spacing(1),
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  semantics: {
    color: t.palette.text.secondary,
  },
  semanticsInput: {
    ...t.typography.body2,
  },
  partition: {
    marginLeft: t.spacing(1),
  },
}))

interface SchemaSectionProps {
  columns: requests.TableColumn[]
  semantics: Record<string, string>
  editable: boolean
  onSaveSemantics: (semantics: Record<string, string>) => Promise<void>
}

// One mental table, two sources: Glue columns (read-only) plus the editable
// Quilt semantics column, visually distinct.
function SchemaSection({
  columns,
  semantics,
  editable,
  onSaveSemantics,
}: SchemaSectionProps) {
  const classes = useSchemaStyles()
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<Record<string, string>>(semantics)
  const [saving, setSaving] = React.useState(false)
  React.useEffect(() => setDraft(semantics), [semantics])
  const handleSave = React.useCallback(async () => {
    setSaving(true)
    try {
      const cleaned = Object.fromEntries(
        Object.entries(draft).filter(([, v]) => v.trim()),
      )
      await onSaveSemantics(cleaned)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [draft, onSaveSemantics])
  return (
    <M.Paper className={classes.root}>
      <M.Box alignItems="center" display="flex">
        <div className={classes.title}>
          Schema
          <span className={classes.note}>from Glue, read-only</span>
        </div>
        <M.Box flexGrow={1} />
        {editable && !editing && (
          <M.Button
            color="primary"
            onClick={() => setEditing(true)}
            size="small"
            startIcon={<M.Icon>edit</M.Icon>}
          >
            Edit semantics
          </M.Button>
        )}
        {editing && (
          <>
            <M.Button disabled={saving} onClick={() => setEditing(false)} size="small">
              Cancel
            </M.Button>
            <M.Button
              color="primary"
              disabled={saving}
              onClick={handleSave}
              size="small"
              variant="contained"
            >
              {saving ? 'Saving…' : 'Save'}
            </M.Button>
          </>
        )}
      </M.Box>
      <M.Table size="small">
        <M.TableHead>
          <M.TableRow>
            <M.TableCell>Column</M.TableCell>
            <M.TableCell>Type</M.TableCell>
            <M.TableCell>Semantics (Quilt, editable)</M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {columns.map((col) => (
            <M.TableRow key={col.name}>
              <M.TableCell className={classes.mono}>
                {col.name}
                {col.partitionKey && (
                  <M.Chip
                    className={classes.partition}
                    label="partition"
                    size="small"
                    variant="outlined"
                  />
                )}
              </M.TableCell>
              <M.TableCell className={classes.mono}>{col.type}</M.TableCell>
              <M.TableCell className={classes.semantics}>
                {editing ? (
                  <M.InputBase
                    className={classes.semanticsInput}
                    fullWidth
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [col.name]: e.target.value }))
                    }
                    placeholder="What this column means"
                    value={draft[col.name] || ''}
                  />
                ) : (
                  semantics[col.name] || col.comment || '—'
                )}
              </M.TableCell>
            </M.TableRow>
          ))}
        </M.TableBody>
      </M.Table>
    </M.Paper>
  )
}

const usePreviewStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
  title: {
    ...t.typography.h6,
  },
  table: {
    marginTop: t.spacing(1),
    maxHeight: 480,
    overflow: 'auto',
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
    whiteSpace: 'nowrap',
  },
}))

interface PreviewSectionProps {
  catalog: string
  database: string
  table: string
}

function PreviewSection({ catalog, database, table }: PreviewSectionProps) {
  const classes = usePreviewStyles()
  const { data, run, running } = requests.usePreview(catalog, database, table)
  return (
    <M.Paper className={classes.root}>
      <M.Box alignItems="center" display="flex">
        <div className={classes.title}>Preview</div>
        <M.Box flexGrow={1} />
        <M.Button
          color="primary"
          disabled={!run || running}
          onClick={run || undefined}
          size="small"
          variant="outlined"
        >
          {running ? 'Running…' : 'Run preview (first 50 rows)'}
        </M.Button>
      </M.Box>
      {Model.isError(data) && (
        <Lab.Alert severity="error">Preview failed: {data.message}</Lab.Alert>
      )}
      {Model.isLoading(data) && <Skeleton height={160} mt={1} animate />}
      {Model.hasData(data) &&
        (data.rows.length ? (
          <M.TableContainer className={classes.table}>
            <M.Table size="small" stickyHeader>
              <M.TableHead>
                <M.TableRow>
                  {data.columns.map((c) => (
                    <M.TableCell key={c.name} className={classes.mono}>
                      {c.name}
                    </M.TableCell>
                  ))}
                </M.TableRow>
              </M.TableHead>
              <M.TableBody>
                {data.rows.map((row, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <M.TableRow key={i}>
                    {row.map((cell, j) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <M.TableCell key={j} className={classes.mono}>
                        {cell}
                      </M.TableCell>
                    ))}
                  </M.TableRow>
                ))}
              </M.TableBody>
            </M.Table>
          </M.TableContainer>
        ) : (
          <M.Typography color="textSecondary" variant="body2">
            The table is empty
          </M.Typography>
        ))}
    </M.Paper>
  )
}

const useDetailStyles = M.makeStyles((t) => ({
  header: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(1),
  },
  name: {
    ...t.typography.h5,
    marginRight: t.spacing(1),
  },
  badge: {
    marginRight: t.spacing(2),
  },
  updated: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
  },
  section: {
    marginTop: t.spacing(2),
  },
}))

interface DetailProps {
  bucket: string
  catalog: string
  database: string
  table: string
}

export default function Detail({ bucket, catalog, database, table }: DetailProps) {
  const classes = useDetailStyles()
  const { urls } = NamedRoutes.use()
  const tableData = requests.useTable(catalog, database, table)
  const context = requests.useTableContext(bucket, catalog, database, table)

  const handleSaveSemantics = React.useCallback(
    async (columnSemantics: Record<string, string>) => {
      if (!Model.hasData(context.value)) return
      await context.save({ ...context.value, columnSemantics })
    },
    [context],
  )

  if (Model.isError(tableData.data)) {
    return (
      <Lab.Alert severity="error">
        <Lab.AlertTitle>Could not load table</Lab.AlertTitle>
        {tableData.data.message}
      </Lab.Alert>
    )
  }

  if (!Model.hasData(tableData.data)) {
    return (
      <>
        <Skeleton height={40} width={320} animate />
        <Skeleton height={160} mt={2} animate />
        <Skeleton height={240} mt={2} animate />
      </>
    )
  }

  const t = tableData.data
  const semantics = Model.hasData(context.value) ? context.value.columnSemantics : {}

  return (
    <>
      <div className={classes.header}>
        <M.IconButton
          component={RR.Link}
          edge="start"
          size="small"
          to={urls.bucketTableList(bucket)}
        >
          <M.Icon>arrow_back</M.Icon>
        </M.IconButton>
        <div className={classes.name}>{t.name}</div>
        <FormatBadge className={classes.badge} format={t.format} />
        {!!t.updatedAt && (
          <div className={classes.updated}>
            updated <Format.Relative value={t.updatedAt} />
          </div>
        )}
        <M.Box flexGrow={1} />
        <M.Button
          color="primary"
          component={RR.Link}
          to={urls.queriesAthena({ catalog, db: database, table: t.name })}
          variant="contained"
        >
          Query this table
        </M.Button>
      </div>

      <Coordinates catalog={catalog} database={database} table={t.name} />

      <div className={classes.section}>
        <ContextSection controller={context} />
      </div>

      <div className={classes.section}>
        <SchemaSection
          columns={t.columns}
          editable={Model.hasData(context.value)}
          onSaveSemantics={handleSaveSemantics}
          semantics={semantics}
        />
      </div>

      <div className={classes.section}>
        <PreviewSection catalog={catalog} database={database} table={t.name} />
      </div>
    </>
  )
}
