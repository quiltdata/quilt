import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'

import { useBucketSection } from './useBucketSection'

interface NavListProps {
  bucket: string
  preferences: BucketPreferences.NavPreferences
  section: string | boolean
}

function NavList({ bucket, preferences, section }: NavListProps) {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const { urls } = NamedRoutes.use()
  return (
    <M.List disablePadding>
      <M.ListItem
        button
        component={Link}
        to={urls.bucketOverview(bucket)}
        selected={section === 'overview'}
      >
        <M.ListItemText primary="Overview" />
      </M.ListItem>
      {preferences.files && (
        <M.ListItem
          button
          component={Link}
          to={urls.bucketDir(bucket)}
          selected={section === 'tree'}
        >
          <M.ListItemText primary="Files" />
        </M.ListItem>
      )}
      {preferences.workflows && (
        <M.ListItem
          button
          component={Link}
          to={urls.bucketWorkflowList(bucket)}
          selected={section === 'workflows'}
        >
          <M.ListItemText primary="Workflows" />
        </M.ListItem>
      )}
      {preferences.packages && (
        <M.ListItem
          button
          component={Link}
          to={urls.bucketPackageList(bucket)}
          selected={section === 'packages'}
        >
          <M.ListItemText primary="Packages" />
        </M.ListItem>
      )}
      {preferences.queries && authenticated && (
        <M.ListItem
          button
          component={Link}
          to={urls.bucketQueries(bucket)}
          selected={section === 'queries'}
        >
          <M.ListItemText primary="Queries" />
        </M.ListItem>
      )}
      {preferences.queries && (section === 'queries' || section === 'es') && (
        <M.ListItem
          button
          component={Link}
          to={urls.bucketESQueries(bucket)}
          selected={section === 'es'}
        >
          <M.ListItemText primary="ElasticSearch" />
        </M.ListItem>
      )}
    </M.List>
  )
}

interface NavProps {
  bucket: string
}

export function Nav({ bucket }: NavProps) {
  const section = useBucketSection()
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { nav } }) => (
        <NavList bucket={bucket} preferences={nav} section={section} />
      ),
      Pending: () => <Skeleton animate />,
      Init: () => null,
    },
    prefs,
  )
}
