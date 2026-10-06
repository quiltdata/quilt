import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import type { JsonSchema } from 'utils/JSONSchema'
import * as Request from 'utils/useRequest'
import * as Workflows from 'utils/workflows'

import * as requests from '../requests'

import * as checks from './checks'

type SchemaResult = Request.Result<JsonSchema | null>

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

// Issues that fail every push before name, message or metadata are looked at.
function schemaIssues(label: string, url: string | undefined, result: SchemaResult) {
  if (!url) return []
  if (result === Request.Idle || result === Request.Loading) {
    return [{ path: label, message: `Loading the ${label} schema…` }]
  }
  if (result instanceof Error) {
    return [{ path: label, message: `Can't read the ${label} schema: ${result.message}` }]
  }
  return checks.checkSchema(result).map((message) => ({ path: label, message }))
}

function TryIt({ workflow, metadataSchema, entriesSchema }: TryItProps) {
  const [name, setName] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [metaText, setMetaText] = React.useState('{}')

  const issues = React.useMemo((): checks.Issue[] => {
    // Fail closed: a schema push can't use must not read as "passes".
    const blocking: checks.Issue[] = [
      ...(workflow.undefinedSchemas || []).map((id) => ({
        path: 'workflow',
        message: `There is no '${id}' in schemas.`,
      })),
      ...schemaIssues('metadata', workflow.schema?.url, metadataSchema),
      ...schemaIssues('entries', workflow.entriesSchema, entriesSchema),
    ]
    // Name and message rules don't depend on schemas, so keep reporting them.
    if (blocking.length) {
      return [
        ...checks.dryRun(workflow, undefined, { name, message, meta: {} }),
        ...blocking,
      ]
    }
    let meta
    try {
      meta = JSON.parse(metaText || '{}')
    } catch {
      return [{ path: 'metadata', message: 'Metadata is not valid JSON' }]
    }
    const schema =
      metadataSchema instanceof Error || typeof metadataSchema === 'symbol'
        ? undefined
        : metadataSchema || undefined
    return checks.dryRun(workflow, schema, { name, message, meta })
  }, [workflow, metadataSchema, entriesSchema, name, message, metaText])

  return (
    <>
      <M.TextField
        fullWidth
        label="Package name"
        margin="dense"
        onChange={(e) => setName(e.target.value)}
        placeholder="namespace/name"
        value={name}
      />
      <M.TextField
        fullWidth
        label="Commit message"
        margin="dense"
        onChange={(e) => setMessage(e.target.value)}
        value={message}
      />
      <M.TextField
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
            Passes the name, message and metadata rules of this workflow.
          </M.Typography>
        )}
      </M.Box>
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
