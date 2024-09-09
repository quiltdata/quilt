import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'
import * as Pagination from 'components/Pagination'
import * as Notifications from 'containers/Notifications'
import * as Dialogs from 'utils/Dialogs'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import parseSearch from 'utils/parseSearch'
import { useTracker } from 'utils/tracking'

import * as Table from '../Table'

import { BucketConfigSelectionFragment as BucketConfig } from './gql/BucketConfigSelection.generated'
import BUCKET_CONFIGS_QUERY from './gql/BucketConfigs.generated'
import REMOVE_MUTATION from './gql/BucketsRemove.generated'

export function ListSkeleton() {
  return (
    <M.Paper>
      <Table.Toolbar heading="Buckets" />
      <Table.Progress />
    </M.Paper>
  )
}

interface DeleteProps {
  bucket: BucketConfig
  close: (reason?: string) => void
}

function Delete({ bucket, close }: DeleteProps) {
  const { push } = Notifications.use()
  const { track } = useTracker()
  const rm = GQL.useMutation(REMOVE_MUTATION)
  const doDelete = React.useCallback(async () => {
    close()
    try {
      const { bucketRemove: r } = await rm({ name: bucket.name })
      switch (r.__typename) {
        case 'BucketRemoveSuccess':
          track('WEB', { type: 'admin', action: 'bucket delete', bucket: bucket.name })
          return
        case 'IndexingInProgress':
          push(`Can't delete bucket "${bucket.name}" while it's being indexed`)
          return
        case 'BucketNotFound':
          push(`Can't delete bucket "${bucket.name}": not found`)
          return
        default:
          assertNever(r)
      }
    } catch (e) {
      push(`Error deleting bucket "${bucket.name}"`)
      // eslint-disable-next-line no-console
      console.error('Error deleting bucket')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }, [bucket, close, rm, push, track])

  return (
    <>
      <M.DialogTitle>Delete a bucket</M.DialogTitle>
      <M.DialogContent>
        You are about to disconnect &quot;{bucket.name}&quot; from Quilt. The search index
        will be deleted. Bucket contents will remain unchanged.
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={doDelete} color="primary">
          Delete
        </M.Button>
      </M.DialogActions>
    </>
  )
}

function useLegacyBucketNameParam() {
  const location = RRDom.useLocation()
  const params = parseSearch(location.search)
  return Array.isArray(params.bucket) ? params.bucket[0] : params.bucket
}

const useCustomBucketIconStyles = M.makeStyles({
  stub: {
    opacity: 0.7,
  },
})

interface CustomBucketIconProps {
  src: string
}

function CustomBucketIcon({ src }: CustomBucketIconProps) {
  const classes = useCustomBucketIconStyles()

  return <BucketIcon alt="" classes={classes} src={src} title="Default icon" />
}

const columns: Table.Column<BucketConfig>[] = [
  {
    id: 'name',
    label: 'Name (relevance)',
    getValue: R.prop('name'),
    getDisplay: (v: string, b: BucketConfig) => (
      <span>
        <M.Box fontFamily="monospace.fontFamily" component="span">
          {v}
        </M.Box>{' '}
        <M.Box color="text.secondary" component="span">
          ({b.relevanceScore})
        </M.Box>
      </span>
    ),
  },
  {
    id: 'icon',
    label: 'Icon',
    sortable: false,
    align: 'center',
    getValue: R.prop('iconUrl'),
    getDisplay: (v: string) => <CustomBucketIcon src={v} />,
  },
  {
    id: 'title',
    label: 'Title',
    getValue: R.prop('title'),
    getDisplay: (v: string) => (
      <M.Box
        component="span"
        maxWidth={240}
        textOverflow="ellipsis"
        overflow="hidden"
        whiteSpace="nowrap"
        display="inline-block"
      >
        {v}
      </M.Box>
    ),
  },
  {
    id: 'description',
    label: 'Description',
    getValue: R.prop('description'),
    getDisplay: (v: string | undefined) =>
      v ? (
        <M.Box
          component="span"
          maxWidth={240}
          textOverflow="ellipsis"
          overflow="hidden"
          whiteSpace="nowrap"
          display="inline-block"
        >
          {v}
        </M.Box>
      ) : (
        <M.Box color="text.secondary" component="span">
          {'<Empty>'}
        </M.Box>
      ),
  },
  {
    id: 'lastIndexed',
    label: 'Last indexed',
    getValue: R.prop('lastIndexed'),
    getDisplay: (v: Date | undefined) =>
      v ? (
        <span title={v.toLocaleString()}>
          {dateFns.formatDistanceToNow(v, { addSuffix: true })}
        </span>
      ) : (
        <M.Box color="text.secondary" component="span">
          {'<N/A>'}
        </M.Box>
      ),
  },
]

export default function List() {
  const { bucketConfigs: rows } = GQL.useQueryS(BUCKET_CONFIGS_QUERY)
  const filtering = Table.useFiltering({
    rows,
    filterBy: ({ name, title }) => name + title,
  })
  const ordering = Table.useOrdering({
    rows: filtering.filtered,
    column: columns[0],
  })
  const pagination = Pagination.use(ordering.ordered, {
    // @ts-expect-error
    getItemId: R.prop('name'),
  })
  const { open: openDialog, render: renderDialogs } = Dialogs.use()

  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const toolbarActions = [
    {
      title: 'Add bucket',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        history.push(urls.adminBuckets({ add: true }))
      }, [history, urls]),
    },
  ]

  const bucketName = useLegacyBucketNameParam()
  if (bucketName) {
    return <RRDom.Redirect to={urls.adminBucketEdit(bucketName)} />
  }

  const edit = (bucket: BucketConfig) => () => {
    history.push(urls.adminBucketEdit(bucket.name))
  }

  const inlineActions = (bucket: BucketConfig) => [
    {
      title: 'Delete',
      icon: <M.Icon>delete</M.Icon>,
      fn: () => {
        openDialog(({ close }) => <Delete {...{ bucket, close }} />)
      },
    },
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: edit(bucket),
    },
  ]

  return (
    <M.Paper>
      {renderDialogs({ maxWidth: 'xs', fullWidth: true })}

      <Table.Toolbar heading="Buckets" actions={toolbarActions}>
        <Table.Filter {...filtering} />
      </Table.Toolbar>
      <Table.Wrapper>
        <M.Table size="small">
          <Table.Head columns={columns} ordering={ordering} withInlineActions />
          <M.TableBody>
            {pagination.paginated.map((bucket: BucketConfig) => (
              <M.TableRow
                hover
                key={bucket.name}
                onClick={edit(bucket)}
                style={{ cursor: 'pointer' }}
              >
                {columns.map((col) => (
                  <M.TableCell key={col.id} align={col.align} {...col.props}>
                    {(col.getDisplay || R.identity)(col.getValue(bucket), bucket)}
                  </M.TableCell>
                ))}
                <M.TableCell
                  align="right"
                  padding="none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Table.InlineActions actions={inlineActions(bucket)} />
                </M.TableCell>
              </M.TableRow>
            ))}
          </M.TableBody>
        </M.Table>
      </Table.Wrapper>
      <Table.Pagination pagination={pagination} />
    </M.Paper>
  )
}
