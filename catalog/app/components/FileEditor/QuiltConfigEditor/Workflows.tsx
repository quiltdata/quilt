import * as React from 'react'
import * as M from '@material-ui/core'

import workflowsBaseSchema from 'schemas/workflows-config-1.1.0.json'

import * as JsonEditorToolbar from 'components/JsonEditor/Toolbar'
import { docs } from 'constants/urls'
import StyledLink from 'utils/StyledLink'

import { ConfigDetailsProps } from './Dummy'
import WorkflowsToolbar from './WorkflowsToolbar'

const toolbarOptions = {
  Toolbar: WorkflowsToolbar,
}

function Header() {
  return (
    <M.Typography variant="body2">
      Configuration for data quality workflows. See{' '}
      <StyledLink href={`${docs}/advanced/workflows`} target="_blank">
        the docs
      </StyledLink>
    </M.Typography>
  )
}

export default function Workflows({ children }: ConfigDetailsProps) {
  return (
    <JsonEditorToolbar.Provider value={toolbarOptions}>
      {children({ header: <Header />, schema: workflowsBaseSchema })}
    </JsonEditorToolbar.Provider>
  )
}
