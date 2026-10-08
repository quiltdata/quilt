import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'
import StyledLink from 'utils/StyledLink'
import * as Request from 'utils/useRequest'
import * as Workflows from 'utils/workflows'

import * as requests from '../requests'

import * as checks from './checks'
import Field from './Field'
import * as model from './model'

type SchemaResult = checks.SchemaResult

export function useSchema(schemaUrl?: string): SchemaResult {
  const s3 = AWS.S3.use()
  // `metadataSchema` throws on unreadable or unparseable schemas, which is what we want to
  // report; `objectSchema` would swallow them.
  const req = React.useCallback(
    () => requests.metadataSchema({ s3, schemaUrl }),
    [s3, schemaUrl],
  )
  return Request.use(req, !!schemaUrl)
}

const isLoaded = (r: SchemaResult): r is Exclude<SchemaResult, Error | symbol> =>
  r !== Request.Idle && r !== Request.Loading && !(r instanceof Error)

// ---------------------------------------------------------------------------------------
// Status: one banner that says whether pushes with this flow can work.

interface Problem {
  severity: 'error' | 'warning'
  title: string
  detail: React.ReactNode
  path?: string
}

function schemaProblem(
  label: string,
  schema: Workflows.SchemaRef | undefined,
  result: SchemaResult,
): Problem | null {
  if (!schema) return null
  const path = s3paths.handleToS3Url(schema.location)
  if (!(result instanceof Error)) {
    if (!isLoaded(result)) return null
    const problems = checks.checkSchema(result)
    if (!problems.length) return null
    return {
      severity: 'error',
      title: `The ${label} rules won't load on push`,
      detail: problems.join(' '),
      path,
    }
  }
  const e = checks.schemaReadError(result, path)
  return {
    severity: e.kind === 'denied' ? 'warning' : 'error',
    title:
      e.kind === 'denied'
        ? `The ${label} rules can't be checked from your account`
        : `The ${label} rules can't be read`,
    detail: e.text,
    path,
  }
}

function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = React.useCallback(() => {
    navigator.clipboard?.writeText(path).then(() => setCopied(true))
  }, [path])
  return (
    <M.Button color="inherit" size="small" onClick={copy}>
      {copied ? 'Copied' : 'Copy path'}
    </M.Button>
  )
}

const useStatusStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(3, 0),
    '& + &': { marginTop: -t.spacing(2) },
    [t.breakpoints.down('xs')]: { flexWrap: 'wrap' },
  },
  action: {
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: t.spacing(1),
    [t.breakpoints.down('xs')]: {
      margin: t.spacing(0, 0, 1, 4.5),
      padding: 0,
      width: '100%',
    },
  },
}))

interface StatusProps {
  workflow: Workflows.Workflow
  metadataSchema: SchemaResult
  entriesSchema: SchemaResult
  onEdit?: () => void
}

export function Status({ workflow, metadataSchema, entriesSchema, onEdit }: StatusProps) {
  const classes = useStatusStyles()
  const problems: Problem[] = []
  workflow.undefinedSchemas?.forEach((id) =>
    problems.push({
      severity: 'error',
      title: 'This flow points at rules that are missing',
      detail: `It names "${id}", which the bucket's flow settings don't define, so every push with this flow fails.`,
    }),
  )
  if (workflow.packageNamePatternInvalid) {
    problems.push({
      severity: 'error',
      title: 'The package name rule is broken',
      detail: `Every push with this flow fails (${workflow.packageNamePatternInvalid}).`,
    })
  }
  const meta = schemaProblem('metadata', workflow.schemas.metadata, metadataSchema)
  if (meta) problems.push(meta)
  const entries = schemaProblem('file', workflow.schemas.entries, entriesSchema)
  if (entries) problems.push(entries)

  const loading = [metadataSchema, entriesSchema].some((r) => r === Request.Loading)

  if (!problems.length) {
    return (
      <Lab.Alert className={classes.root} severity={loading ? 'info' : 'success'}>
        {loading
          ? 'Checking this flow…'
          : 'Ready. Its rules load and pushes will accept them.'}
      </Lab.Alert>
    )
  }

  return (
    <>
      {problems.map((p, i) => (
        <Lab.Alert
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={classes.root}
          classes={{ action: classes.action }}
          severity={p.severity}
          icon={p.severity === 'warning' ? <M.Icon>lock</M.Icon> : undefined}
          action={
            <>
              {p.path && <CopyPath path={p.path} />}
              {onEdit && (
                <M.Button
                  color="inherit"
                  size="small"
                  variant="outlined"
                  onClick={onEdit}
                >
                  Edit flow
                </M.Button>
              )}
            </>
          }
        >
          <Lab.AlertTitle>{p.title}</Lab.AlertTitle>
          {p.detail}
        </Lab.Alert>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------------------
// Cards

const useCardStyles = M.makeStyles((t) => ({
  header: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: t.spacing(1.5),
    padding: t.spacing(1.5, 2),
  },
  icon: {
    color: t.palette.text.secondary,
  },
  title: {
    ...t.typography.subtitle1,
    fontWeight: t.typography.fontWeightMedium,
    flexGrow: 1,
  },
  hint: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    textAlign: 'right',
  },
  body: {
    padding: t.spacing(1, 2, 2),
  },
}))

interface CardProps {
  icon: string
  title: string
  hint?: React.ReactNode
  className?: string
}

export function Card({
  icon,
  title,
  hint,
  className,
  children,
}: React.PropsWithChildren<CardProps>) {
  const classes = useCardStyles()
  return (
    <M.Paper variant="outlined" className={className} component="section">
      <header className={classes.header}>
        <M.Icon className={classes.icon}>{icon}</M.Icon>
        <h2 className={classes.title}>{title}</h2>
        {hint && <span className={classes.hint}>{hint}</span>}
      </header>
      <div className={classes.body}>{children}</div>
    </M.Paper>
  )
}

// ---------------------------------------------------------------------------------------
// Rules

function SchemaLink({
  schema,
  children,
}: React.PropsWithChildren<{ schema?: Workflows.SchemaRef }>) {
  const { urls } = NamedRoutes.use()
  if (!schema) return <>{children}</>
  const l = schema.location
  return (
    <StyledLink to={urls.bucketFile(l.bucket, l.key, { version: l.version })}>
      {children}
    </StyledLink>
  )
}

const TYPE_WORDS: Record<model.FieldType, string> = {
  text: 'text',
  number: 'number',
  integer: 'whole number',
  boolean: 'yes or no',
  date: 'date',
  choice: 'choice',
}

const useRulesStyles = M.makeStyles((t) => ({
  list: {
    margin: 0,
  },
  row: {
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'grid',
    gap: t.spacing(0.5, 2),
    gridTemplateColumns: '9.5rem minmax(0, 1fr)',
    padding: t.spacing(1, 0),
    '&:last-child': { borderBottom: 0 },
    [t.breakpoints.down('xs')]: { gridTemplateColumns: '1fr' },
  },
  key: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  value: {
    ...t.typography.body2,
    margin: 0,
    minWidth: 0,
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
    overflowWrap: 'anywhere',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
    marginBottom: t.spacing(0.5),
  },
  caption: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
  },
}))

interface RulesProps {
  workflow: Workflows.Workflow
  metadataSchema: SchemaResult
}

export function Rules({ workflow, metadataSchema }: RulesProps) {
  const classes = useRulesStyles()
  const fields = isLoaded(metadataSchema)
    ? model.schemaToFields(metadataSchema)
    : undefined

  const name = workflow.handlePattern ? (
    <>
      Matches <code className={classes.mono}>{workflow.handlePattern}</code>
      {workflow.packageNamePatternError && (
        <div className={classes.caption}>Checked on push only</div>
      )}
    </>
  ) : (
    <>
      Any <code className={classes.mono}>team/name</code>
    </>
  )

  let metadata: React.ReactNode = 'Anything'
  if (workflow.schema) {
    if (fields === undefined) metadata = "Must match this flow's schema"
    else if (fields === null) {
      metadata = (
        <SchemaLink schema={workflow.schemas.metadata}>
          Advanced rules the editor can&apos;t show
        </SchemaLink>
      )
    } else {
      const required = fields.filter((f) => f.required)
      const optional = fields.filter((f) => !f.required)
      metadata = (
        <>
          <div className={classes.chips}>
            {required.map((f) => (
              <M.Chip
                key={f.name}
                label={f.name}
                size="small"
                title={`${TYPE_WORDS[f.type]}${f.type === 'choice' ? `: ${f.options.join(', ')}` : ''}`}
              />
            ))}
          </div>
          <div className={classes.caption}>
            {required.length ? 'Required.' : 'Nothing required.'}
            {optional.length
              ? ` Optional: ${optional.map((f) => f.name).join(', ')}`
              : ''}
          </div>
        </>
      )
    }
  }

  const rows: [string, React.ReactNode][] = [
    ['Package name', name],
    ['Commit message', workflow.isMessageRequired ? 'Required' : 'Optional'],
    ['Metadata', metadata],
  ]
  if (workflow.schemas.metadata) {
    rows.push([
      'Schema file',
      <SchemaLink key="schema" schema={workflow.schemas.metadata}>
        <span className={classes.mono}>
          {s3paths.handleToS3Url(workflow.schemas.metadata.location)}
        </span>
      </SchemaLink>,
    ])
  }
  if (workflow.schemas.entries) {
    rows.push([
      'Files',
      <SchemaLink key="entries" schema={workflow.schemas.entries}>
        Must match the file rules
      </SchemaLink>,
    ])
  }

  return (
    <dl className={classes.list}>
      {rows.map(([k, v]) => (
        <div key={k} className={classes.row}>
          <dt className={classes.key}>{k}</dt>
          <dd className={classes.value}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------------------------------
// Try it: a form built from the flow's fields, checked on blur and on Check.

const useTryStyles = M.makeStyles((t) => ({
  grid: {
    display: 'grid',
    gap: t.spacing(1, 3),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    paddingTop: t.spacing(1),
    [t.breakpoints.down('xs')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  full: {
    gridColumn: '1 / -1',
  },
  section: {
    ...t.typography.overline,
    borderTop: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    gridColumn: '1 / -1',
    marginTop: t.spacing(1),
    paddingTop: t.spacing(1.5),
  },
  verdict: {
    alignItems: 'center',
    gridColumn: '1 / -1',
    marginTop: t.spacing(1),
  },
}))

// Field ids an issue path names: `name`, `message`, `/field`.
const issueKey = (path: string) => (path.startsWith('/') ? path.split('/')[1] : path)

interface TryItProps {
  workflow: Workflows.Workflow
  metadataSchema: SchemaResult
  entriesSchema: SchemaResult
}

export function TryIt({ workflow, metadataSchema, entriesSchema }: TryItProps) {
  const classes = useTryStyles()
  const [name, setName] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [metaText, setMetaText] = React.useState('{}')
  const [touched, setTouched] = React.useState<Set<string>>(() => new Set())
  const [checked, setChecked] = React.useState(false)

  const hasSchema = !!workflow.schema
  const fields = React.useMemo(
    () =>
      isLoaded(metadataSchema)
        ? model.schemaToFormFields(metadataSchema)
        : hasSchema
          ? undefined
          : [],
    [metadataSchema, hasSchema],
  )

  const issues = React.useMemo(
    () =>
      checks.tryIt(
        workflow,
        { metadata: metadataSchema, entries: entriesSchema },
        {
          name,
          message,
          metaText: fields ? JSON.stringify(model.formToMeta(fields, values)) : metaText,
        },
      ),
    [workflow, metadataSchema, entriesSchema, name, message, fields, values, metaText],
  )

  const byField = React.useMemo(() => {
    const m: Record<string, string> = {}
    issues.forEach((i) => {
      const k = issueKey(i.path)
      if (!m[k])
        m[k] = /^must have required property/.test(i.message) ? 'Required' : i.message
    })
    return m
  }, [issues])
  const shown = (k: string) => (checked || touched.has(k) ? byField[k] : undefined)
  const blur = (k: string) => () => setTouched((s) => new Set(s).add(k))
  const fieldNames = new Set(['name', 'message', ...(fields || []).map((f) => f.name)])
  // Issues that don't belong to one input, e.g. an unreadable schema.
  const general = issues.filter(
    (i) => !fieldNames.has(issueKey(i.path)) && fields !== null,
  )

  const setValue = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }))

  return (
    <form
      className={classes.grid}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setChecked(true)
      }}
    >
      <Field
        error={!!shown('name')}
        helperText={shown('name') || 'Format team/name'}
        label="Package name"
        onBlur={blur('name')}
        onChange={(e) => setName(e.target.value)}
        placeholder="team/dataset"
        required
        size="small"
        value={name}
        variant="outlined"
      />
      <Field
        error={!!shown('message')}
        helperText={shown('message') || ' '}
        label="Commit message"
        onBlur={blur('message')}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What changed"
        required={!!workflow.isMessageRequired}
        size="small"
        value={message}
        variant="outlined"
      />

      {workflow.schema && <div className={classes.section}>Metadata</div>}
      {fields === undefined && workflow.schema && (
        <M.Typography className={classes.full} variant="body2" color="textSecondary">
          {metadataSchema === Request.Loading
            ? 'Loading this flow’s fields…'
            : 'Metadata fields appear here once the rules can be read.'}
        </M.Typography>
      )}
      {fields?.map((f) => (
        <MetaInput
          key={f.name}
          field={f}
          error={shown(f.name)}
          onBlur={blur(f.name)}
          onChange={setValue(f.name)}
          value={values[f.name] ?? ''}
        />
      ))}
      {fields === null && (
        <Field
          className={classes.full}
          helperText="These rules are too advanced for the form, so enter metadata as JSON."
          label="Metadata (JSON)"
          rows={4}
          multiline
          onChange={(e) => setMetaText(e.target.value)}
          size="small"
          value={metaText}
          variant="outlined"
        />
      )}

      <Lab.Alert
        className={classes.verdict}
        severity={!checked ? 'info' : issues.length ? 'error' : 'success'}
        icon={checked ? undefined : <M.Icon>science</M.Icon>}
        action={
          <M.Button color="primary" type="submit" variant="contained" size="small">
            Check
          </M.Button>
        }
      >
        {!checked
          ? 'Fill in the fields, then check them against this flow.'
          : issues.length
            ? `${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} would stop this push.`
            : "Passes this flow's rules. File checks run on push."}
        {checked && !!general.length && (
          <ul>
            {general.map((i, n) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        )}
        {checked && fields === null && !!issues.length && (
          <ul>
            {issues
              .filter((i) => !['name', 'message'].includes(i.path))
              .map((i, n) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={n}>
                  {i.path && i.path !== '/' ? `${i.path}: ` : ''}
                  {i.message}
                </li>
              ))}
          </ul>
        )}
      </Lab.Alert>
    </form>
  )
}

interface MetaInputProps {
  field: model.FormField
  value: string
  error?: string
  onChange: (v: string) => void
  onBlur: () => void
}

function MetaInput({ field, value, error, onChange, onBlur }: MetaInputProps) {
  const common = {
    error: !!error,
    helperText: error || field.help || ' ',
    label: field.label,
    onBlur,
    required: field.required,
    size: 'small' as const,
    value,
    variant: 'outlined' as const,
  }
  switch (field.type) {
    case 'choice':
    case 'boolean':
      return (
        <Field {...common} select onChange={(e) => onChange(e.target.value)}>
          <M.MenuItem value="">
            <em>Not set</em>
          </M.MenuItem>
          {(field.type === 'boolean' ? ['true', 'false'] : field.options).map((o) => (
            <M.MenuItem key={o} value={o}>
              {field.type === 'boolean' ? (o === 'true' ? 'Yes' : 'No') : o}
            </M.MenuItem>
          ))}
        </Field>
      )
    case 'date':
      return (
        <Field
          {...common}
          InputLabelProps={{ shrink: true }}
          onChange={(e) => onChange(e.target.value)}
          type="date"
        />
      )
    case 'number':
    case 'integer':
      return (
        <Field
          {...common}
          inputProps={{ inputMode: field.type === 'integer' ? 'numeric' : 'decimal' }}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default:
      return <Field {...common} onChange={(e) => onChange(e.target.value)} />
  }
}
