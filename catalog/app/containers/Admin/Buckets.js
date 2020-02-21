import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'redux-form/es/immutable'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import * as Dialogs from 'utils/Dialogs'
import * as Cache from 'utils/ResourceCache'
import * as validators from 'utils/validators'

import * as Form from './Form'
import * as Table from './Table'
import * as data from './data'

/*
values:
  title=data['title'],
  description=data.get('description'),
  icon_url=data.get('icon_url'),
  sns_notification_arn=data.get('sns_notification_arn'),
  scanner_parallel_shards_depth=data.get('scanner_parallel_shards_depth'),
  schema_org=data.get('schema_org'),
  overview_url=data.get('overview_url'),
  skip_meta_data_indexing=data.get('skip_meta_data_indexing'),
  file_extensions_to_index=data.get('file_extensions_to_index'),
  tags=data.get('tags'),
  relevance_score=data.get('relevance_score', 0)
*/

function Add({ close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const onSubmit = React.useCallback(
    async (valuesI) => {
      const values = valuesI.toJS()
      console.log('submit', values)
      try {
        const res = await req({
          endpoint: '/admin/buckets',
          method: 'POST',
          body: JSON.stringify(data.bucketToJSON(values)),
        })
        const b = data.bucketFromJSON(res)
        console.log('res', { res, b })
        cache.patchOk(data.BucketsResource, null, R.append(b))
        push(`Bucket "${b.name}" added`)
        close()
      } catch (e) {
        if (APIConnector.HTTPError.is(e, 409, /Bucket already added/)) {
          throw new RF.SubmissionError({ name: 'conflict' })
        }
        // eslint-disable-next-line no-console
        console.error('Error adding bucket')
        // eslint-disable-next-line no-console
        console.dir(e)
        throw new RF.SubmissionError({ _error: 'unexpected' })
      }
    },
    [req, cache, push, close],
  )

  return (
    <Form.ReduxForm form="Admin.Buckets.Add" onSubmit={onSubmit}>
      {({ handleSubmit, submitting, submitFailed, error, invalid }) => (
        <>
          <M.DialogTitle>Add a bucket</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="name"
                // TODO: properly validate
                validate={[validators.required]}
                label="Name"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a bucket name',
                  conflict: 'Bucket already added',
                }}
              />
              <RF.Field
                component={Form.Field}
                name="title"
                // TODO: properly validate
                validate={[validators.required]}
                label="Title"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a bucket title',
                }}
              />
              <RF.Field
                component={Form.Field}
                name="description"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Description"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="iconUrl"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Icon URL"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="relevanceScore"
                // TODO: properly validate
                // validate={[validators.required]}
                // TODO: some help text / docs link maybe?
                label="Relevance score"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="overviewUrl"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Overview URL"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="linkedData"
                // TODO: properly validate
                // validate={[validators.required]}
                // TODO: some help text / docs link maybe?
                label="Linked data (schema.org)"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {/* TODO: fancy multi-input or separated by commas */}
              <RF.Field
                component={Form.Field}
                name="tags"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Tags"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {/* TODO: fancy multi-input or separated by commas */}
              <RF.Field
                component={Form.Field}
                name="fileExtensionsToIndex"
                // TODO: properly validate
                // validate={[validators.required]}
                label="File extensions to index"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="scannerParallelShardsDepth"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Scanner parallel shards depth"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {/* TODO: use toggle */}
              <RF.Field
                component={Form.Field}
                name="skipMetaDataIndexing"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Skip metadata indexing"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="snsNotificationArn"
                // TODO: properly validate
                // validate={[validators.required]}
                label="SNS notification ARN"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {submitFailed && (
                <Form.FormError
                  error={error}
                  errors={{
                    unexpected: 'Something went wrong',
                  }}
                />
              )}
              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button
              onClick={() => close('cancel')}
              color="primary"
              disabled={submitting}
            >
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              disabled={submitting || (submitFailed && invalid)}
            >
              Create
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </Form.ReduxForm>
  )
}

function Edit({ bucket, close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const res = await req({
          endpoint: `/admin/buckets/${bucket.name}`,
          method: 'PUT',
          body: JSON.stringify(data.bucketToJSON(values.toJS())),
        })
        const updated = data.bucketFromJSON(res)
        cache.patchOk(
          data.BucketsResource,
          null,
          R.map((b) => (b.name === bucket.name ? updated : b)),
        )
        close()
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating bucket')
        // eslint-disable-next-line no-console
        console.dir(e)
        throw new RF.SubmissionError({ _error: 'unexpected' })
      }
    },
    [req, cache, close],
  )

  return (
    <Form.ReduxForm
      form={`Admin.Buckets.Edit(${bucket.name})`}
      onSubmit={onSubmit}
      initialValues={bucket}
    >
      {({ handleSubmit, submitting, submitFailed, error, invalid }) => (
        <>
          <M.DialogTitle>Edit the &quot;{bucket.name}&quot; bucket</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <RF.Field
                component={Form.Field}
                name="title"
                // TODO: properly validate
                validate={[validators.required]}
                label="Title"
                fullWidth
                margin="normal"
                errors={{
                  required: 'Enter a bucket title',
                }}
              />
              <RF.Field
                component={Form.Field}
                name="description"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Description"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="iconUrl"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Icon URL"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="relevanceScore"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Relevance score"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="overviewUrl"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Overview URL"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="linkedData"
                // TODO: properly validate
                // validate={[validators.required]}
                // TODO: some help text / docs link maybe?
                label="Linked data (schema.org)"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {/* TODO: fancy multi-input or separated by commas */}
              <RF.Field
                component={Form.Field}
                name="tags"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Tags"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {/* TODO: fancy multi-input or separated by commas */}
              <RF.Field
                component={Form.Field}
                name="fileExtensionsToIndex"
                // TODO: properly validate
                // validate={[validators.required]}
                label="File extensions to index"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="scannerParallelShardsDepth"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Scanner parallel shards depth"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {/* TODO: use toggle */}
              <RF.Field
                component={Form.Field}
                name="skipMetaDataIndexing"
                // TODO: properly validate
                // validate={[validators.required]}
                label="Skip metadata indexing"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              <RF.Field
                component={Form.Field}
                name="snsNotificationArn"
                // TODO: properly validate
                // validate={[validators.required]}
                label="SNS notification ARN"
                fullWidth
                margin="normal"
                // errors={{ }}
              />
              {submitFailed && (
                <Form.FormError
                  error={error}
                  errors={{
                    unexpected: 'Something went wrong',
                  }}
                />
              )}
              <input type="submit" style={{ display: 'none' }} />
            </form>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button
              onClick={() => close('cancel')}
              color="primary"
              disabled={submitting}
            >
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              disabled={submitting || (submitFailed && invalid)}
            >
              Save
            </M.Button>
            {/* TODO: reset button? */}
          </M.DialogActions>
        </>
      )}
    </Form.ReduxForm>
  )
}

function Delete({ bucket, close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const doDelete = React.useCallback(async () => {
    close()
    try {
      // optimistically remove the bucket from cache
      cache.patchOk(data.BucketsResource, null, R.reject(R.propEq('name', bucket.name)))
      await req({ endpoint: `/admin/buckets/${bucket.name}`, method: 'DELETE' })
    } catch (e) {
      // TODO: handle errors
      // put the bucket back into cache if it hasnt been deleted properly
      cache.patchOk(data.BucketsResource, null, R.append(bucket))
      push(`Error deleting bucket "${bucket.name}"`)
      // eslint-disable-next-line no-console
      console.error('Error deleting bucket')
      // eslint-disable-next-line no-console
      console.dir(e)
    }
  }, [bucket, close, req, cache, push])

  return (
    <>
      <M.DialogTitle>Delete a bucket</M.DialogTitle>
      <M.DialogContent>
        You are about to delete the &quot;{bucket.name}&quot; bucket. This operation is
        irreversible.
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

const columns = [
  {
    id: 'name',
    label: 'Name',
    getValue: R.prop('name'),
    getDisplay: (v) => (
      <M.Box fontFamily="monospace.fontFamily" component="span">
        {v}
      </M.Box>
    ),
  },
  {
    id: 'title',
    label: 'Title',
    getValue: R.prop('title'),
    getDisplay: (v) => (
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
    getDisplay: (v) =>
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
    getDisplay: (v) =>
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

function CRUD({ buckets }) {
  const rows = Cache.suspend(buckets)
  const ordering = Table.useOrdering({ rows, column: columns[0] })
  const pagination = Pagination.use(ordering.ordered, {
    getItemId: R.prop('name'),
  })
  const dialogs = Dialogs.use()

  const toolbarActions = [
    {
      title: 'Add bucket',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        dialogs.open(({ close }) => <Add {...{ close }} />)
      }, [dialogs.open]),
    },
  ]

  const inlineActions = (bucket) => [
    {
      title: 'Delete',
      icon: <M.Icon>delete</M.Icon>,
      fn: () => {
        dialogs.open(({ close }) => <Delete {...{ bucket, close }} />)
      },
    },
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: () => {
        dialogs.open(({ close }) => <Edit {...{ bucket, close }} />)
      },
    },
  ]

  return (
    <M.Paper>
      {dialogs.render({ maxWidth: 'xs', fullWidth: true })}
      <Table.Toolbar heading="Buckets" actions={toolbarActions} />
      <Table.Wrapper>
        <M.Table size="small">
          <Table.Head columns={columns} ordering={ordering} withInlineActions />
          <M.TableBody>
            {pagination.paginated.map((i) => (
              <M.TableRow hover key={i.name}>
                {columns.map((col) => (
                  <M.TableCell key={col.id} {...col.props}>
                    {(col.getDisplay || R.identity)(col.getValue(i), i)}
                  </M.TableCell>
                ))}
                <M.TableCell align="right" padding="none">
                  <Table.InlineActions actions={inlineActions(i)} />
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

export default function Buckets() {
  const req = APIConnector.use()
  const buckets = Cache.useData(data.BucketsResource, { req })
  return (
    <M.Box mt={2} mb={2}>
      <React.Suspense
        fallback={
          <M.Paper>
            <Table.Toolbar heading="Buckets" />
            <Table.Progress />
          </M.Paper>
        }
      >
        <CRUD buckets={buckets} />
      </React.Suspense>
    </M.Box>
  )
}
