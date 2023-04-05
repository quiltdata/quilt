import * as React from 'react'
import * as M from '@material-ui/core'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import { docs } from 'constants/urls'
import StyledLink from 'utils/StyledLink'

import { ConfigDetailsProps } from './Dummy'

function Header() {
  return (
    <M.Typography variant="body2">
      Configuration for Catalog UI: show and hide features, set default values. See{' '}
      <StyledLink href={`${docs}/catalog/preferences`} target="_blank">
        the docs
      </StyledLink>
    </M.Typography>
  )
}

export default function BucketPreferences({ children }: ConfigDetailsProps) {
  return children({ header: <Header />, schema: bucketPreferencesSchema })
}
