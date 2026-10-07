import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import useId from 'utils/useId'
import * as Request from 'utils/useRequest'
import * as Workflows from 'utils/workflows'

import * as requests from '../requests'

import * as checks from './checks'
import * as model from './model'

// MUI only links a TextField's label to its input when it has an id.
export function Field(props: M.TextFieldProps) {
  const id = useId()
  return <M.TextField id={id} {...props} />
}

type SchemaResult = checks.SchemaResult

function useSchema(schemaUrl?: string): SchemaResult {
  const s3 = AWS.S3.use()
  // `metadataSchema` throws on unreadable or unparseable schemas, which is what we want to
  // report; `objectSchema` would swallow them.
  const req = React.useCallback(
    () => requests.metadataSchema({ s3, schemaUrl }),
    [s3, schemaUrl],
  )
  return Request.use(req, !!schemaUrl)
}

const useCheckStyles = M.makeStyles((t) => ({
  ok: { color: t.palette.success.main },
  error: { color: t.palette.error.main },
}))

interface SchemaCheckProps {
  label: string
  schema?: Workflows.SchemaRef
  result: SchemaResult
}

function SchemaCheck({ label, schema, result }: SchemaCheckProps) {
  const classes = useCheckStyles()
  if (!schema) return null

  let problems: string[] = []
  let pending = false
  if (result === Request.Idle || result === Request.Loading) pending = true
  else if (result instanceof Error) problems = [`Can't read schema: ${result.message}`]
  else problems = checks.checkSchema(result)

  return (
    <M.ListItem disableGutters>
      <M.ListItemIcon>
        {pending ? (
          <M.CircularProgress size={20} />
        ) : (
          <M.Icon className={problems.length ? classes.error : classes.ok}>
            {problems.length ? 'error' : 'check_circle'}
          </M.Icon>
        )}
      </M.ListItemIcon>
      <M.ListItemText
        primary={`${label}: ${schema.name}`}
        secondary={
          pending
            ? 'Checking…'
            : problems.length
              ? problems.join('; ')
              : 'Readable, draft-07, no $ref, compiles'
        }
      />
    </M.ListItem>
  )
}

interface TryItProps {
  workflow: Workflows.Workflow
  metadataSchema: SchemaResult
  entriesSchema: SchemaResult
}

function TryIt({ workflow, metadataSchema, entriesSchema }: TryItProps) {
  const [name, setName] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [metaText, setMetaText] = React.useState('{}')

  const issues = React.useMemo(
    () =>
      checks.tryIt(
        workflow,
        { metadata: metadataSchema, entries: entriesSchema },
        { name, message, metaText },
      ),
    [workflow, metadataSchema, entriesSchema, name, message, metaText],
  )

  return (
    <>
      <Field
        fullWidth
        label="Package name"
        margin="dense"
        variant="outlined"
        onChange={(e) => setName(e.target.value)}
        placeholder="namespace/name"
        value={name}
      />
      <Field
        fullWidth
        label="Commit message"
        margin="dense"
        variant="outlined"
        onChange={(e) => setMessage(e.target.value)}
        value={message}
      />
      <Field
        fullWidth
        label="Metadata (JSON)"
        margin="dense"
        rows={4}
        multiline
        onChange={(e) => setMetaText(e.target.value)}
        value={metaText}
        variant="outlined"
      />
      <M.Box mt={1}>
        {issues.length ? (
          <M.List dense>
            {issues.map((issue, i) => (
              <M.ListItem key={i} disableGutters>
                <M.ListItemText
                  primary={issue.message}
                  secondary={issue.path || undefined}
                  primaryTypographyProps={{ color: 'error' }}
                />
              </M.ListItem>
            ))}
          </M.List>
        ) : (
          <M.Typography variant="body2">
            Passes this flow's name, message and metadata rules.
          </M.Typography>
        )}
      </M.Box>
    </>
  )
}

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
  number: 'a number',
  integer: 'a whole number',
  boolean: 'yes or no',
  date: 'a date',
  choice: 'one of',
}

function RulesSummary({
  workflow,
  metadataSchema,
}: {
  workflow: Workflows.Workflow
  metadataSchema: SchemaResult
}) {
  const fields =
    metadataSchema &&
    typeof metadataSchema === 'object' &&
    !(metadataSchema instanceof Error)
      ? model.schemaToFields(metadataSchema)
      : undefined
  const rules: React.ReactNode[] = []
  if (workflow.packageNamePattern) {
    rules.push(
      <>
        Package names match{' '}
        <code>{workflow.packageNamePattern.source.replace(/\\\//g, '/')}</code>
      </>,
    )
  }
  if (workflow.packageNamePatternError) {
    rules.push('Package names must match a pattern only the push can check')
  }
  if (workflow.isMessageRequired) rules.push('A commit message is required')
  if (workflow.schema) {
    if (fields === undefined) rules.push("Metadata must match this flow's schema")
    else if (fields === null) {
      rules.push(
        <>
          Metadata must match{' '}
          <SchemaLink schema={workflow.schemas.metadata}>
            a schema with rules the builder can&apos;t show
          </SchemaLink>
        </>,
      )
    } else {
      fields.forEach((f) =>
        rules.push(
          <>
            <strong>{f.name}</strong> is {TYPE_WORDS[f.type]}
            {f.type === 'choice' ? ` ${f.options.join(', ')}` : ''}
            {f.required ? '' : ' (optional)'}
          </>,
        ),
      )
    }
  }
  if (workflow.entriesSchema) {
    rules.push(
      <>
        Package files must match{' '}
        <SchemaLink schema={workflow.schemas.entries}>
          this flow&apos;s file rules
        </SchemaLink>
      </>,
    )
  }
  return (
    <>
      <M.Box mt={3} mb={1}>
        <M.Typography variant="h5">Rules</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          What a package must have to be pushed with this flow.
        </M.Typography>
      </M.Box>
      {rules.length ? (
        <M.List dense>
          {rules.map((r, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <M.ListItem key={i} disableGutters>
              <M.ListItemIcon>
                <M.Icon fontSize="small">rule</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary={r} />
            </M.ListItem>
          ))}
        </M.List>
      ) : (
        <M.Typography variant="body2">
          No rules: any package can use this flow.
        </M.Typography>
      )}
    </>
  )
}

interface HealthProps {
  workflow: Workflows.Workflow
}

export default function Health({ workflow }: HealthProps) {
  const metadataSchema = useSchema(workflow.schema?.url)
  const entriesSchema = useSchema(workflow.entriesSchema)
  const hasSchemas = !!workflow.schemas.metadata || !!workflow.schemas.entries

  return (
    <>
      <RulesSummary workflow={workflow} metadataSchema={metadataSchema} />
      <M.Box mt={3} mb={1}>
        <M.Typography variant="h5">Health</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Checked with your permissions. Pushes run under the stack&apos;s own role.
        </M.Typography>
      </M.Box>
      {workflow.packageNamePatternError && (
        <M.Typography variant="body2" color="error" gutterBottom>
          {`Package name pattern can't be checked in the browser (${workflow.packageNamePatternError}). Pushes still enforce it.`}
        </M.Typography>
      )}
      {workflow.undefinedSchemas?.map((id) => (
        <M.Typography key={id} variant="body2" color="error" gutterBottom>
          Schema &quot;{id}&quot; is not defined under <code>schemas</code> in the config,
          so every push with this workflow fails.
        </M.Typography>
      ))}
      {hasSchemas ? (
        <M.List dense>
          <SchemaCheck
            label="Metadata schema"
            schema={workflow.schemas.metadata}
            result={metadataSchema}
          />
          <SchemaCheck
            label="Entries schema"
            schema={workflow.schemas.entries}
            result={entriesSchema}
          />
        </M.List>
      ) : workflow.undefinedSchemas?.length ? null : (
        <M.Typography variant="body2">
          No schemas: only the package name and message rules apply.
        </M.Typography>
      )}

      <M.Box mt={3} mb={1}>
        <M.Typography variant="h5">Try it</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          See every error a push would hit, before you push. File entries are not checked
          here.
        </M.Typography>
      </M.Box>
      <TryIt
        workflow={workflow}
        metadataSchema={metadataSchema}
        entriesSchema={entriesSchema}
      />
    </>
  )
}
