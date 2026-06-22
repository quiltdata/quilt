import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import { Plural, Relative } from 'utils/format'
import { formatQuantity, readableBytes } from 'utils/string'
import * as Model from 'model'

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

function Section({ children }: React.PropsWithChildren<{}>) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <SectionHeader>Latest packages</SectionHeader>
      {children}
    </div>
  )
}

function Skeletons() {
  const classes = useStyles()
  return (
    <Section>
      <M.List dense disablePadding className={classes.list}>
        {Array.from({ length: MAX_PACKAGES }, (_, i) => (
          <M.ListItem key={i} className={classes.card}>
            <Skeleton height={32} animate />
          </M.ListItem>
        ))}
      </M.List>
    </Section>
  )
}

function ErrorMessage({ children }: React.PropsWithChildren<{}>) {
  return (
    <Section>
      <Lab.Alert severity="error">Could not load packages: {children}</Lab.Alert>
    </Section>
  )
}

interface PackageListProps {
  bucket: string
  hits: PackageHit[]
  total: number
}

function PackageList({ bucket, hits, total }: PackageListProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const numMore = total - hits.length
  return (
    <Section>
      <M.List dense disablePadding className={classes.list}>
        {hits.map((hit) => (
          <M.ListItem
            key={hit.id}
            button
            component={RRDom.Link}
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
          component={RRDom.Link}
          to={urls.bucketPackageList(bucket)}
          size="small"
          color="primary"
        >
          {formatQuantity(numMore)} more{' '}
          <Plural value={numMore} one="package" other="packages" />
        </M.Button>
      )}
    </Section>
  )
}

interface RecentPackagesProps {
  bucket: string
}

export default function RecentPackages({ bucket }: RecentPackagesProps) {
  const query = GQL.useQuery(RECENT_PACKAGES_QUERY, {
    buckets: [bucket],
    order: Model.GQLTypes.SearchResultOrder.NEWEST,
  })
  return GQL.fold(query, {
    fetching: () => <Skeletons />,
    error: (e) => <ErrorMessage>{e.message}</ErrorMessage>,
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
          return null
        case 'PackagesSearchResultSet': {
          const hits = r.firstPage.hits.slice(0, MAX_PACKAGES)
          return hits.length ? (
            <PackageList bucket={bucket} hits={hits} total={r.total} />
          ) : null
        }
        case 'InvalidInput':
          return <ErrorMessage>{r.errors.map((e) => e.message).join(', ')}</ErrorMessage>
        case 'OperationError':
          return <ErrorMessage>{r.message}</ErrorMessage>
        default:
          return assertNever(r)
      }
    },
  })
}
