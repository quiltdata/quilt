import * as React from 'react'
import * as M from '@material-ui/core'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import { docs } from 'constants/urls'
import StyledLink from 'utils/StyledLink'
import type { JsonSchema } from 'utils/json-schema'

function Toolbar() {
  return (
    <M.Typography>
      Configuration for Catalog UI: show and hide features, set default values. See{' '}
      <StyledLink href={`${docs}/catalog/preferences`} target="_blank">
        the docs
      </StyledLink>
    </M.Typography>
  )
}

interface BucketPreferencesProps {
  children: (props: {
    schema: JsonSchema
    toolbar: React.ReactNode
  }) => React.ReactElement
}

export default function BucketPreferences({ children }: BucketPreferencesProps) {
  return children({ schema: bucketPreferencesSchema, toolbar: <Toolbar /> })
}
