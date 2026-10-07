import * as React from 'react'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import * as quiltConfigs from 'constants/quiltConfigs'
import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'
import * as Workflows from 'utils/workflows'
import * as YAML from 'utils/yaml'

import * as requests from '../requests'
import MANIFEST_QUERY from '../PackageDialog/gql/Manifest.generated'

import { Field } from './Health'
import * as model from './model'

const CONFIG_KEY = quiltConfigs.workflows

const TYPE_LABELS: Record<model.FieldType, string> = {
  text: 'Text',
  number: 'Number',
  integer: 'Whole number',
  boolean: 'Yes / no',
  date: 'Date',
  choice: 'One of a list',
}

type S3 = ReturnType<typeof AWS.S3.use>

interface Loaded {
  raw: Record<string, any> | undefined
  // Both, because an unversioned bucket has no VersionId
  version: string | undefined
  etag: string | undefined
  hasComments: boolean
}

async function readConfig(s3: S3, bucket: string): Promise<Loaded> {
  let r
  try {
    r = await s3.getObject({ Bucket: bucket, Key: CONFIG_KEY }).promise()
  } catch (e: any) {
    if (e?.code === 'NoSuchKey') {
      return { raw: undefined, version: undefined, etag: undefined, hasComments: false }
    }
    throw e
  }
  const text = r.Body?.toString('utf-8') ?? ''
  const raw = YAML.parseStrict<Record<string, any>>(text)
  // Saving over a config we couldn't read would drop every other flow.
  if (raw instanceof Error) {
    throw new Error(
      `This bucket's flow settings can't be read, so they can't be edited here: ${raw.message}`,
    )
  }
  if (raw !== undefined && (typeof raw !== 'object' || Array.isArray(raw))) {
    throw new Error(
      "This bucket's flow settings aren't in the expected format, so they can't be edited here.",
    )
  }
  return {
    raw: raw || undefined,
    version: r.VersionId,
    etag: r.ETag,
    hasComments: /(^|\s)#/m.test(text),
  }
}

function explain(e: any): string {
  if (e?.code === 'AccessDenied' || e?.code === 'Forbidden') {
    return "You don't have permission to change flows in this bucket."
  }
  return e instanceof Error ? e.message : String(e)
}

function useFlowStore(bucket: string) {
  const s3 = AWS.S3.use()
  const loadedRef = React.useRef<Loaded>()

  const load = React.useCallback(async () => {
    loadedRef.current = await readConfig(s3, bucket)
    return loadedRef.current
  }, [s3, bucket])

  // Re-reads and compares before anything is written, and parses what will be written,
  // so a failed save changes nothing.
  const prepare = React.useCallback(
    async (next: Record<string, any>) => {
      const current = await readConfig(s3, bucket)
      const loaded = loadedRef.current
      if (current.version !== loaded?.version || current.etag !== loaded?.etag) {
        throw new Error(
          'Flows in this bucket changed while you were editing. Reopen and try again.',
        )
      }
      const body = YAML.stringify(next)
      Workflows.parse(body, bucket)
      return body
    },
    [s3, bucket],
  )

  const putConfig = React.useCallback(
    (body: string) =>
      s3.putObject({ Bucket: bucket, Key: CONFIG_KEY, Body: body }).promise(),
    [s3, bucket],
  )

  const save = React.useCallback(
    async (draft: model.FlowDraft, promote: model.Promote[]) => {
      const raw = loadedRef.current?.raw
      const schema = draft.fields?.length
        ? model.schemaLocation(raw ?? {}, bucket, draft)
        : null
      const body = await prepare(
        model.applyPromote(model.applyFlow(raw, draft, schema), promote),
      )
      if (schema && draft.fields) {
        await s3
          .putObject({
            Bucket: bucket,
            Key: s3paths.parseS3Url(schema.url).key,
            Body: JSON.stringify(model.fieldsToSchema(draft.fields), null, 2),
            ContentType: 'application/json',
          })
          .promise()
      }
      await putConfig(body)
    },
    [s3, bucket, prepare, putConfig],
  )

  const remove = React.useCallback(
    async (id: string) => {
      const raw = loadedRef.current?.raw
      if (!raw) return
      await putConfig(await prepare(model.removeFlow(raw, id)))
    },
    [prepare, putConfig],
  )

  return { load, save, remove }
}

const useFieldStyles = M.makeStyles((t) => ({
  row: {
    alignItems: 'flex-start',
    display: 'grid',
    gap: t.spacing(1.5),
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.4fr) auto auto',
    marginBottom: t.spacing(1),
  },
  options: {
    gridColumn: '1 / 3',
    marginTop: t.spacing(-0.5),
  },
}))

interface FieldRowProps {
  field: model.Field
  error?: string
  onChange: (f: model.Field) => void
  onRemove: () => void
}

function FieldRow({ field, error, onChange, onRemove }: FieldRowProps) {
  const classes = useFieldStyles()
  return (
    <div className={classes.row}>
      <Field
        error={!!error}
        helperText={error}
        label="Field"
        onChange={(e) => onChange({ ...field, name: e.target.value })}
        size="small"
        value={field.name}
        variant="outlined"
      />
      <Field
        label="Type"
        onChange={(e) => onChange({ ...field, type: e.target.value as model.FieldType })}
        select
        size="small"
        value={field.type}
        variant="outlined"
      >
        {Object.entries(TYPE_LABELS).map(([value, label]) => (
          <M.MenuItem key={value} value={value}>
            {label}
          </M.MenuItem>
        ))}
      </Field>
      <M.FormControlLabel
        control={
          <M.Checkbox
            checked={field.required}
            color="primary"
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
          />
        }
        label="Required"
      />
      <M.IconButton aria-label={`Remove ${field.name || 'field'}`} onClick={onRemove}>
        <M.Icon>delete_outline</M.Icon>
      </M.IconButton>
      {field.type === 'choice' && (
        <Field
          className={classes.options}
          helperText="Separate choices with commas"
          label="Choices"
          onChange={(e) =>
            onChange({
              ...field,
              options: e.target.value
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean),
            })
          }
          size="small"
          defaultValue={field.options.join(', ')}
          variant="outlined"
        />
      )}
    </div>
  )
}

function useStartFromPackage(bucket: string) {
  const client = urql.useClient()
  return React.useCallback(
    async (name: string): Promise<model.Field[]> => {
      const r = await client
        .query(MANIFEST_QUERY, {
          bucket,
          name: name.trim(),
          hashOrTag: 'latest',
          max: 0,
          skipEntries: true,
        })
        .toPromise()
      const meta = r.data?.package?.revision?.userMeta
      if (!r.data?.package?.revision)
        throw new Error(`No package "${name}" in this bucket`)
      const fields = model.fieldsFromMeta(meta ?? {})
      if (!fields.length)
        throw new Error('That package has no simple metadata fields to copy')
      return fields
    },
    [client, bucket],
  )
}

const useStyles = M.makeStyles((t) => ({
  section: {
    marginTop: t.spacing(3),
  },
  sectionTitle: {
    ...t.typography.subtitle1,
    fontWeight: t.typography.fontWeightMedium,
  },
  hint: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1.5),
  },
  inline: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: t.spacing(1),
    marginTop: t.spacing(1),
  },
  promoteRow: {
    alignItems: 'center',
    display: 'grid',
    gap: t.spacing(1.5),
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto auto',
    marginBottom: t.spacing(1),
  },
  spacer: {
    flexGrow: 1,
  },
}))

interface EditorProps {
  bucket: string
  config: Workflows.WorkflowsConfig
  workflow?: Workflows.Workflow
  onClose: () => void
  onSaved: (id: string | null) => void
}

export default function Editor({
  bucket,
  config,
  workflow,
  onClose,
  onSaved,
}: EditorProps) {
  const classes = useStyles()
  const store = useFlowStore(bucket)
  const startFrom = useStartFromPackage(bucket)
  const s3 = AWS.S3.use()
  const isNew = !workflow
  const existingIds = React.useMemo(
    () => config.workflows.flatMap((w) => (typeof w.slug === 'string' ? [w.slug] : [])),
    [config.workflows],
  )

  const [draft, setDraft] = React.useState<model.FlowDraft>(() => ({
    id: typeof workflow?.slug === 'string' ? workflow.slug : '',
    name: workflow?.name ?? '',
    description: workflow?.description ?? '',
    namePattern: workflow?.packageNamePattern?.source ?? '',
    messageRequired: !!workflow?.isMessageRequired,
    fields: [],
  }))
  const [promote, setPromote] = React.useState<model.Promote[]>([])
  const [ready, setReady] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [submitted, setSubmitted] = React.useState(false)
  const [pkgName, setPkgName] = React.useState('')
  const [hasComments, setHasComments] = React.useState(false)
  const [canRemove, setCanRemove] = React.useState(false)
  // Bumped when fields are replaced wholesale, so rows don't keep stale inputs
  // Stable keys, so removing a row never shows another row's inputs
  const idRef = React.useRef(0)
  const nextId = () => (idRef.current += 1)
  const [rowIds, setRowIds] = React.useState<number[]>([])
  const [promoteIds, setPromoteIds] = React.useState<number[]>([])
  const [originalPattern, setOriginalPattern] = React.useState<string>()

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const loaded = await store.load()
        const prev = workflow && loaded.raw?.workflows?.[draft.id]
        if (workflow && !prev) throw new Error('This flow was removed. Close and reload.')
        const schemaKey = prev?.metadata_schema
        const schemaUrl = schemaKey ? loaded.raw?.schemas?.[schemaKey]?.url : undefined
        let fields: model.Field[] | null = schemaKey && !schemaUrl ? null : []
        if (schemaUrl) {
          fields = model.schemaToFields(await requests.metadataSchema({ s3, schemaUrl }))
        }
        if (cancelled) return
        setDraft((d) =>
          prev
            ? {
                ...d,
                name: prev.name ?? '',
                description: prev.description ?? '',
                // The raw pattern, not the browser translation of it
                namePattern: prev.handle_pattern ?? '',
                messageRequired: !!prev.is_message_required,
                fields,
              }
            : { ...d, fields },
        )
        setRowIds((fields ?? []).map(nextId))
        const targets = model.promoteFromConfig(loaded.raw)
        setPromote(targets)
        setPromoteIds(targets.map(nextId))
        setHasComments(loaded.hasComments)
        setOriginalPattern(prev?.handle_pattern)
        setCanRemove(model.canRemove(loaded.raw))
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(explain(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // Load once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toSave = React.useMemo(
    () => (isNew ? { ...draft, id: model.slugify(draft.name) } : draft),
    [draft, isNew],
  )
  const errors = {
    ...model.validateDraft(toSave, { isNew, existingIds, originalPattern }),
    ...model.validatePromote(promote),
  }
  const shownErrors = submitted ? errors : {}

  const setFields = (fields: model.Field[]) => setDraft((d) => ({ ...d, fields }))

  const handleSave = async () => {
    setSubmitted(true)
    if (Object.keys(errors).length) return
    setBusy(true)
    setError(undefined)
    try {
      await store.save(toSave, promote)
      onSaved(toSave.id)
    } catch (e) {
      setError(explain(e))
      setBusy(false)
    }
  }

  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await store.remove(draft.id)
      onSaved(null)
    } catch (e) {
      setError(explain(e))
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const handleStartFrom = async () => {
    setError(undefined)
    try {
      const fields = await startFrom(pkgName)
      setFields(fields)
      setRowIds(fields.map(nextId))
    } catch (e) {
      setError(explain(e))
    }
  }

  return (
    <M.Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <M.DialogTitle>{isNew ? 'New flow' : `Edit flow: ${workflow?.name}`}</M.DialogTitle>
      <M.DialogContent>
        {error && (
          <M.Box mb={2}>
            <M.Typography color="error" role="alert">
              {error}
            </M.Typography>
          </M.Box>
        )}
        {ready && hasComments && (
          <M.Box mb={2}>
            <M.Typography variant="body2" color="textSecondary">
              Saving rewrites this bucket&apos;s flow settings file, so notes written in
              it by hand are removed.
            </M.Typography>
          </M.Box>
        )}
        {!ready ? (
          !error && <M.LinearProgress />
        ) : (
          <>
            <Field
              autoFocus={isNew}
              error={!!shownErrors.name}
              fullWidth
              helperText={
                shownErrors.name ||
                (isNew && draft.name ? `Saved as "${toSave.id}"` : undefined)
              }
              label="Name"
              margin="dense"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              value={draft.name}
              variant="outlined"
            />
            <Field
              fullWidth
              label="Description"
              margin="dense"
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              value={draft.description}
              variant="outlined"
            />

            <div className={classes.section}>
              <div className={classes.sectionTitle}>Rules</div>
              <div className={classes.hint}>
                What a package must have to be pushed with this flow.
              </div>
              <Field
                error={!!shownErrors.namePattern}
                fullWidth
                helperText={
                  shownErrors.namePattern ||
                  'A regular expression, e.g. ^lab/ for names starting with "lab/". Leave empty to allow any name.'
                }
                label="Package names must match"
                margin="dense"
                onChange={(e) => setDraft((d) => ({ ...d, namePattern: e.target.value }))}
                value={draft.namePattern}
                variant="outlined"
              />
              <M.FormControlLabel
                control={
                  <M.Switch
                    checked={draft.messageRequired}
                    color="primary"
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, messageRequired: e.target.checked }))
                    }
                  />
                }
                label="Require a commit message"
              />
            </div>

            <div className={classes.section}>
              <div className={classes.sectionTitle}>Required metadata</div>
              {draft.fields === null ? (
                <>
                  <div className={classes.hint}>
                    This flow&apos;s metadata schema uses features the builder can&apos;t
                    show, so it stays as it is.
                  </div>
                  <M.Button onClick={() => setFields([])} size="small" variant="outlined">
                    Replace it with builder fields
                  </M.Button>
                </>
              ) : (
                <>
                  <div className={classes.hint}>
                    Fields every package&apos;s metadata must include.
                  </div>
                  {draft.fields.map((f, i) => (
                    <FieldRow
                      // Index keys: rows have no identity until named
                      // eslint-disable-next-line react/no-array-index-key
                      key={rowIds[i]}
                      error={shownErrors[`fields.${i}`]}
                      field={f}
                      onChange={(nf) =>
                        setFields(draft.fields!.map((x, j) => (j === i ? nf : x)))
                      }
                      onRemove={() => {
                        setFields(draft.fields!.filter((_, j) => j !== i))
                        setRowIds(rowIds.filter((_, j) => j !== i))
                      }}
                    />
                  ))}
                  <div className={classes.inline}>
                    <M.Button
                      color="primary"
                      onClick={() => {
                        setFields([...draft.fields!, model.emptyField()])
                        setRowIds([...rowIds, nextId()])
                      }}
                      size="small"
                      startIcon={<M.Icon>add</M.Icon>}
                    >
                      Add field
                    </M.Button>
                    <div className={classes.spacer} />
                    <Field
                      label="Start from package"
                      onChange={(e) => setPkgName(e.target.value)}
                      placeholder="namespace/name"
                      size="small"
                      value={pkgName}
                      variant="outlined"
                    />
                    <M.Button
                      disabled={!pkgName.includes('/')}
                      onClick={handleStartFrom}
                      size="small"
                      variant="outlined"
                    >
                      Copy its fields
                    </M.Button>
                  </div>
                </>
              )}
            </div>

            <div className={classes.section}>
              <div className={classes.sectionTitle}>Promote to</div>
              <div className={classes.hint}>
                Buckets packages from here can be pushed to. Applies to every flow in this
                bucket.
              </div>
              {promote.map((p, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div className={classes.promoteRow} key={promoteIds[i]}>
                  <Field
                    error={!!shownErrors[`promote.${i}`]}
                    helperText={shownErrors[`promote.${i}`]}
                    label="Bucket"
                    onChange={(e) =>
                      setPromote(
                        promote.map((x, j) =>
                          j === i ? { ...x, bucket: e.target.value } : x,
                        ),
                      )
                    }
                    size="small"
                    value={p.bucket}
                    variant="outlined"
                  />
                  <Field
                    label="Label"
                    onChange={(e) =>
                      setPromote(
                        promote.map((x, j) =>
                          j === i ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                    size="small"
                    value={p.title}
                    variant="outlined"
                  />
                  <M.FormControlLabel
                    control={
                      <M.Checkbox
                        checked={p.copyData}
                        color="primary"
                        onChange={(e) =>
                          setPromote(
                            promote.map((x, j) =>
                              j === i ? { ...x, copyData: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                    }
                    label="Copy files"
                  />
                  <M.IconButton
                    aria-label={`Remove ${p.bucket || 'bucket'}`}
                    onClick={() => {
                      setPromote(promote.filter((_, j) => j !== i))
                      setPromoteIds(promoteIds.filter((_, j) => j !== i))
                    }}
                  >
                    <M.Icon>delete_outline</M.Icon>
                  </M.IconButton>
                </div>
              ))}
              <M.Button
                color="primary"
                onClick={() => {
                  setPromote([...promote, { bucket: '', title: '', copyData: true }])
                  setPromoteIds([...promoteIds, nextId()])
                }}
                size="small"
                startIcon={<M.Icon>add</M.Icon>}
              >
                Add bucket
              </M.Button>
            </div>
          </>
        )}
      </M.DialogContent>
      <M.DialogActions>
        {!isNew && ready && canRemove && (
          <M.Button
            disabled={busy}
            onClick={handleDelete}
            style={{ marginRight: 'auto' }}
            color={confirmDelete ? 'secondary' : 'default'}
          >
            {confirmDelete
              ? 'Confirm delete (pushed packages keep their flow)'
              : 'Delete flow'}
          </M.Button>
        )}
        <M.Button disabled={busy} onClick={onClose}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          disabled={!ready || busy}
          onClick={handleSave}
          variant="contained"
        >
          {busy ? 'Saving…' : isNew ? 'Create flow' : 'Save'}
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
