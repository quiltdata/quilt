import * as React from 'react'

import workflowsBaseSchema from 'schemas/workflows-config-1.1.0.json'

import type { JsonSchema } from 'utils/json-schema'

interface WorkflowsProps {
  children: (props: { schema: JsonSchema }) => React.ReactElement
}

export default function Workflows({ children }: WorkflowsProps) {
  return children({ schema: workflowsBaseSchema })
}
