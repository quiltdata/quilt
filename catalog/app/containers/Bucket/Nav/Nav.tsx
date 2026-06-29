import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'

import { useBucketSection } from './useBucketSection'

const useStyles = M.makeStyles((t) => ({
  active: {
    fontWeight: t.typography.fontWeightBold,
  },
}))

interface NavListProps {
  bucket: string
  preferences: BucketPreferences.NavPreferences
  section: string | boolean
}

function NavList({ bucket, preferences, section }: NavListProps) {
  const classes = useStyles()
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const { urls } = NamedRoutes.use()
  const items = [
    { value: 'overview', label: 'Overview', to: urls.bucketOverview(bucket), show: true },
    {
      value: 'tree',
      label: 'Files',
      to: urls.bucketDir(bucket),
      show: preferences.files,
    },
    {
      value: 'workflows',
      label: 'Workflows',
      to: urls.bucketWorkflowList(bucket),
      show: preferences.workflows,
    },
    {
      value: 'packages',
      label: 'Packages',
      to: urls.bucketPackageList(bucket),
      show: preferences.packages,
    },
    {
      value: 'queries',
      label: 'Queries',
      to: urls.bucketQueries(bucket),
      show: preferences.queries && authenticated,
    },
    {
      value: 'es',
      label: 'ElasticSearch',
      to: urls.bucketESQueries(bucket),
      show: preferences.queries && (section === 'queries' || section === 'es'),
    },
  ]
  return (
    <M.List disablePadding dense>
      {items
        .filter((i) => i.show)
        .map((i) => (
          <M.ListItem button component={Link} to={i.to} key={i.value}>
            <M.ListItemText
              primary={i.label}
              primaryTypographyProps={
                section === i.value ? { className: classes.active } : undefined
              }
            />
          </M.ListItem>
        ))}
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
