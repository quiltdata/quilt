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

import SectionHeader from './SectionHeader'

const MAX_PACKAGES = 2

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

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
  },
  card: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
  },
  more: {
    marginTop: t.spacing(1),
  },
}))

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

  const head = <SectionHeader>Latest packages</SectionHeader>

  if (result === null) {
    return (
      <div className={classes.root}>
        {head}
        <M.List dense disablePadding className={classes.list}>
          {Array.from({ length: MAX_PACKAGES }, (_, i) => (
            <M.ListItem key={i} className={classes.card}>
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
      {head}
      <M.List dense disablePadding className={classes.list}>
        {hits.map((hit) => (
          <M.ListItem
            key={hit.id}
            button
            component={RRLink}
            className={classes.card}
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
      {numMore > 0 && (
        <M.Button
          className={classes.more}
          component={RRLink}
          to={urls.bucketPackageList(bucket)}
          size="small"
          color="primary"
        >
          {formatQuantity(numMore)} more{' '}
          <Plural value={numMore} one="package" other="packages" />
        </M.Button>
      )}
    </div>
  )
}
