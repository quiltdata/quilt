import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
import * as Listing from 'containers/Bucket/Listing'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import DP_QUERY from './gql/DataProduct.generated'

const useStyles = M.makeStyles((t) => ({
  header: {
    marginBottom: t.spacing(2),
  },
}))

interface DataProductScreenProps {
  id: string
}

function DataProductScreen({ id }: DataProductScreenProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const q = GQL.useQuery(DP_QUERY, { id })

  const noop = React.useCallback(() => {}, [])

  return GQL.fold(q, {
    fetching: () => (
      <Container>
        <M.CircularProgress />
      </Container>
    ),
    error: (err) => (
      <Container>
        <M.Typography variant="h4" gutterBottom>
          Data product
        </M.Typography>
        <M.Typography color="error">
          Error loading data product: {err.message}
        </M.Typography>
      </Container>
    ),
    data: (data) => {
      const dp = data.dataProduct
      if (!dp) {
        return (
          <Container>
            <M.Typography variant="h4" gutterBottom>
              Data product
            </M.Typography>
            <M.Typography>Data product not found</M.Typography>
          </Container>
        )
      }

      // Two non-intersecting namespaces, dereferenced + readable-scoped by the
      // server, rendered as one bucket-like listing. Packages open in place at
      // their pinned revision (or latest); objects open in place at the native
      // file view.
      const packageItems: Listing.Item[] = dp.members.packages.map((p) => ({
        type: 'dir' as const,
        name: p.virtualName,
        to: urls.bucketPackageTree(p.bucket, p.name, p.hashOrTag ?? undefined),
      }))
      const objectItems: Listing.Item[] = dp.members.objects.map((o) => ({
        type: 'file' as const,
        name: o.logicalKey,
        to: urls.bucketFile(
          o.bucket,
          o.key,
          o.versionId ? { version: o.versionId } : undefined,
        ),
      }))
      const items = [...packageItems, ...objectItems]

      return (
        <Container>
          <MetaTitle>{dp.name}</MetaTitle>
          <M.Typography variant="h4" className={classes.header}>
            {dp.name}
          </M.Typography>
          {items.length ? (
            <Listing.Listing items={items} onReload={noop} />
          ) : (
            <M.Typography color="textSecondary">No readable members</M.Typography>
          )}
        </Container>
      )
    },
  })
}

export default function DataProduct() {
  const { id } = useParams<{ id: string }>()
  return <Layout pre={<DataProductScreen id={id} />} />
}
