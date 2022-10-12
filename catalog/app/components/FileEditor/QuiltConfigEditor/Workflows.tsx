import * as React from 'react'
import * as M from '@material-ui/core'

import workflowsBaseSchema from 'schemas/workflows-config-1.1.0.json'

import { docs } from 'constants/urls'
import StyledLink from 'utils/StyledLink'
import type { JsonSchema } from 'utils/json-schema'

function Toolbar() {
  return (
    <M.Typography>
      Configuration for data quality workflows. See{' '}
      <StyledLink href={`${docs}/advanced/workflows`} target="_blank">
        the docs
      </StyledLink>
    </M.Typography>
  )
}

interface WorkflowsProps {
  children: (props: {
    schema: JsonSchema
    toolbar: React.ReactNode
  }) => React.ReactElement
}

export default function Workflows({ children }: WorkflowsProps) {
  return children({ schema: workflowsBaseSchema, toolbar: <Toolbar /> })
}
