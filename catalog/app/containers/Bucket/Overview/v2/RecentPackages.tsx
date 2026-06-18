import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import { Plural, Relative } from 'utils/format'
import { formatQuantity, readableBytes } from 'utils/string'
import { SearchResultOrder } from 'model/graphql/types.generated'

import RECENT_PACKAGES_QUERY from '../gql/RecentPackages.generated'

import SectionTitle from './SectionTitle'

const MAX_PACKAGES = 3

type PackageHit = Extract<
  GQL.DataForDoc<typeof RECENT_PACKAGES_QUERY>['searchPackages'],
  { __typename: 'PackagesSearchResultSet' }
>['firstPage']['hits'][number]

function PackageSecondary({ hit }: { hit: PackageHit }) {
  return (
    <>
      {readableBytes(hit.size)}
      {' · '}
      <M.Tooltip arrow title={hit.modified.toLocaleString()}>
        <span>
          Updated <Relative value={hit.modified} />
        </span>
      </M.Tooltip>
    </>
  )
}

const useStyles = M.makeStyles({
  root: {
    width: '100%',
  },
  head: {
    alignItems: 'baseline',
    display: 'flex',
    justifyContent: 'space-between',
  },
})

interface RecentPackagesProps {
  bucket: string
}

export default function RecentPackages({ bucket }: RecentPackagesProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const query = GQL.useQuery(RECENT_PACKAGES_QUERY, {
    buckets: [bucket],
    order: SearchResultOrder.NEWEST,
  })
  const result = GQL.fold(query, {
    data: ({ searchPackages: r }) =>
      r.__typename === 'PackagesSearchResultSet'
        ? { hits: r.firstPage.hits.slice(0, MAX_PACKAGES), total: r.total }
        : { hits: [], total: 0 },
    fetching: () => null,
    error: () => ({ hits: [], total: 0 }),
  })

  const head = (more?: React.ReactNode) => (
    <div className={classes.head}>
      <SectionTitle>Latest packages</SectionTitle>
      {more}
    </div>
  )

  if (result === null) {
    return (
      <div className={classes.root}>
        {head()}
        <M.List dense>
          {Array.from({ length: MAX_PACKAGES }, (_, i) => (
            <M.ListItem key={i} disableGutters>
              <Skeleton height={32} animate />
            </M.ListItem>
          ))}
        </M.List>
      </div>
    )
  }

  const { hits, total } = result
  // Hide the section entirely when the bucket has no packages.
  if (!hits.length) return null

  const numMore = total - hits.length
  return (
    <div className={classes.root}>
      {head(
        numMore > 0 && (
          <M.Button
            component={RRLink}
            to={urls.bucketPackageList(bucket)}
            size="small"
            color="primary"
          >
            {formatQuantity(numMore)} more{' '}
            <Plural value={numMore} one="package" other="packages" />
          </M.Button>
        ),
      )}
      <M.List dense>
        {hits.map((hit) => (
          <M.ListItem
            key={hit.id}
            button
            disableGutters
            component={RRLink}
            to={urls.bucketPackageTree(
              hit.bucket,
              hit.name,
              hit.pointer === 'latest' ? hit.pointer : hit.hash,
            )}
          >
            <M.ListItemText
              primary={hit.name}
              primaryTypographyProps={{ noWrap: true }}
              secondary={<PackageSecondary hit={hit} />}
            />
          </M.ListItem>
        ))}
      </M.List>
    </div>
  )
}
