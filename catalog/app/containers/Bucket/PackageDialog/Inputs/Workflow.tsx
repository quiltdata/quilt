import * as React from 'react'
import * as M from '@material-ui/core'

import { FlowsLink } from 'components/FileEditor/HelpLinks'
import { docs } from 'constants/urls'
import useId from 'utils/useId'
import * as workflows from 'utils/workflows'

import type { FormStatus } from '../State/form'
import type { SchemaStatus } from '../State/schema'
import type { WorkflowState, WorkflowsConfigStatus } from '../State/workflow'
import { WorkflowsInputSkeleton } from '../Skeleton'

const useStyles = M.makeStyles((t) => ({
  crop: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  error: {
    marginRight: t.spacing(1),
  },
  spinner: {
    flex: 'none',
    marginRight: t.spacing(3),
  },
  text: {
    marginTop: 0,
    marginBottom: 0,
  },
}))

interface SelectWorkflowProps {
  bucket: string
  disabled?: boolean
  error?: React.ReactNode
  items: workflows.Workflow[]
  onChange: (v: workflows.Workflow) => void
  value?: workflows.Workflow
}

function SelectWorkflow({
  bucket,
  disabled,
  error,
  items,
  onChange,
  value,
}: SelectWorkflowProps) {
  const classes = useStyles()

  const noChoice = items.length === 1
  const labelId = useId()
  const id = useId()

  return (
    <M.FormControl disabled={disabled || noChoice} fullWidth size="small" error={!!error}>
      <M.InputLabel id={labelId} shrink>
        Flow
      </M.InputLabel>
      <M.Select
        labelId={labelId}
        id={id}
        value={value ? value.slug.toString() : workflows.notSelected.toString()}
      >
        {items.map((workflow) => (
          <M.MenuItem
            key={workflow.slug.toString()}
            value={workflow.slug.toString()}
            onClick={() => !workflow.isDisabled && onChange(workflow)}
            disabled={workflow.isDisabled}
            dense
          >
            <M.ListItemText
              className={classes.text}
              classes={{
                primary: classes.crop,
                secondary: classes.crop,
              }}
              primary={workflow.name || 'None'}
              secondary={workflow.description}
            />
          </M.MenuItem>
        ))}
      </M.Select>
      <M.FormHelperText>
        {!!error && <span className={classes.error}>{error}</span>}
        <FlowsLink bucket={bucket}>Manage this bucket&apos;s flows</FlowsLink> or{' '}
        <M.Link href={`${docs}/workflows`} target="_blank">
          learn about flows
        </M.Link>
      </M.FormHelperText>
    </M.FormControl>
  )
}

interface InputWorkflowProps {
  bucket: string
  formStatus: FormStatus
  schema: SchemaStatus
  state: WorkflowState
  config: WorkflowsConfigStatus
}

/**
 * Workflow selection dropdown for data quality validation.
 *
 * Allows users to select a workflow that defines validation rules
 * and metadata schemas for the package.
 */
export default function InputWorkflow({
  bucket,
  formStatus,
  schema,
  state: { status, value, onChange },
  config,
}: InputWorkflowProps) {
  const error = React.useMemo(() => {
    if (config._tag === 'error') return config.error.message
    if (status._tag === 'error') return status.error.message
    return undefined
  }, [status, config])
  if (config._tag === 'idle') return null
  if (config._tag === 'loading') return <WorkflowsInputSkeleton />
  return (
    <SelectWorkflow
      bucket={bucket}
      disabled={schema._tag === 'loading' || formStatus._tag === 'submitting'}
      error={error}
      items={config.config.workflows}
      onChange={onChange}
      value={value}
    />
  )
}
