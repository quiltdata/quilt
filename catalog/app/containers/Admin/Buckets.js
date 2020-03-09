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

const useBucketFieldsStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.up('md')]: {
      display: 'grid',
      gridAutoFlow: 'column',
      gridColumnGap: t.spacing(3),
    },
  },
  group: {
    '& + &': {
      [t.breakpoints.down('sm')]: {
        marginTop: t.spacing(2),
      },
    },
    '& > *:first-child': {
      marginTop: 0,
    },
  },
}))

function BucketFields({ add = false }) {
  const classes = useBucketFieldsStyles()
  return (
    <M.Box className={classes.root}>
      <M.Box className={classes.group}>
        <RF.Field
          component={Form.Field}
          name="name"
          label="Name"
          normalize={R.pipe(R.toLower, R.replace(/[^a-z0-9-.]/g, ''), R.take(63))}
          validate={[validators.required]}
          errors={{
            required: 'Enter a bucket name',
            conflict: 'Bucket already added',
          }}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="title"
          label="Title"
          // TODO: trim
          normalize={R.pipe(R.replace(/^\s+/g, ''), R.take(256))}
          validate={[validators.required]}
          errors={{
            required: 'Enter a bucket title',
          }}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="iconUrl"
          label="Icon URL"
          normalize={R.pipe(R.trim, R.take(1024))}
          // TODO: preview img
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="description"
          label="Description"
          // TODO: trim down the line
          normalize={R.pipe(R.replace(/^\s+/g, ''), R.take(1024))}
          multiline
          rows={1}
          rowsMax={3}
          fullWidth
          margin="normal"
        />
      </M.Box>
      <M.Box className={classes.group}>
        <RF.Field
          component={Form.Field}
          name="relevanceScore"
          label="Relevance score"
          // TODO: some help text / docs link maybe?
          // TODO: parse int further down the pipeline
          normalize={R.pipe(
            R.replace(/[^0-9-]/g, ''),
            R.replace(/(.+)-+$/g, '$1'),
            R.take(16),
          )}
          validate={[validators.integer]}
          errors={{
            integer: 'Enter a valid integer',
          }}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="overviewUrl"
          label="Overview URL"
          normalize={R.trim}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="tags"
          label="Tags (comma-separated)"
          // TODO: process down the line: split, trim, reject empty & repeats
          fullWidth
          margin="normal"
          multiline
          rows={1}
          maxRows={3}
        />
        <RF.Field
          component={Form.Field}
          name="linkedData"
          // TODO: some help text / docs link maybe?
          // TODO: validate top level entity is an object?
          label="Structured data (JSON-LD)"
          validate={[validators.json]}
          errors={{
            json: 'Must be a valid JSON',
          }}
          fullWidth
          multiline
          rows={1}
          rowsMax={10}
          margin="normal"
        />
      </M.Box>
      <M.Box className={classes.group}>
        <RF.Field
          component={Form.Field}
          name="fileExtensionsToIndex"
          label="File extensions to index (comma-separated)"
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="scannerParallelShardsDepth"
          label="Scanner parallel shards depth"
          validate={[validators.integer]}
          errors={{
            integer: 'Enter a valid integer',
          }}
          // TODO: parse int further down the pipeline
          normalize={R.pipe(R.replace(/[^0-9]/g, ''), R.take(16))}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="snsNotificationArn"
          label="SNS notification ARN"
          fullWidth
          margin="normal"
        />
        <M.Box mt={2}>
          <RF.Field
            component={Form.Checkbox}
            type="checkbox"
            name="skipMetaDataIndexing"
            label="Skip metadata indexing"
          />
        </M.Box>
        {add && (
          <M.Box mt={1}>
            <RF.Field
              component={Form.Checkbox}
              type="checkbox"
              name="delayScan"
              label="Delay scan"
            />
          </M.Box>
        )}
      </M.Box>
    </M.Box>
  )
}

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
              <BucketFields add />
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
              <BucketFields />
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
    id: 'icon',
    label: 'Icon',
    sortable: false,
    align: 'center',
    getValue: R.prop('iconUrl'),
    getDisplay: (v) =>
      !!v && (
        <M.Box
          component="img"
          src={v}
          alt=""
          height={40}
          width={40}
          mt={-0.25}
          mb={-0.25}
        />
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
        dialogs.open(({ close }) => <Add {...{ close }} />, { maxWidth: 'lg' })
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
        dialogs.open(({ close }) => <Edit {...{ bucket, close }} />, { maxWidth: 'lg' })
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
                  <M.TableCell key={col.id} align={col.align} {...col.props}>
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
