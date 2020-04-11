import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'redux-form/es/immutable'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import Delay from 'utils/Delay'
import * as Dialogs from 'utils/Dialogs'
import * as Cache from 'utils/ResourceCache'
import { useTracker } from 'utils/tracking'
import * as validators from 'utils/validators'

import * as Form from './Form'
import * as Table from './Table'
import * as data from './data'

const REGIONS = {
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'ap-east-1': 'Asia Pacific (Hong Kong)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-northeast-3': 'Asia Pacific (Osaka-Local)',
  'ca-central-1': 'Canada (Central)',
  'cn-north-1': 'China (Beijing)',
  'cn-northwest-1': 'China (Ningxia)',
  'eu-central-1': 'Europe (Frankfurt)',
  'eu-west-1': 'Europe (Ireland)',
  'eu-west-2': 'Europe (London)',
  'eu-west-3': 'Europe (Paris)',
  'eu-north-1': 'Europe (Stockholm)',
  'sa-east-1': 'South America (São Paulo)',
  'me-south-1': 'Middle East (Bahrain)',
}

const DEFAULT_REGION = 'us-east-1'

const useBucketFieldsStyles = M.makeStyles((t) => ({
  group: {
    '& > *:first-child': {
      marginTop: 0,
    },
  },
  panel: {
    margin: '0 !important',
    '&::before': {
      content: 'none',
    },
  },
  panelSummary: {
    padding: 0,
    minHeight: 'auto !important',
  },
  panelSummaryContent: {
    margin: `${t.spacing(1)}px 0 !important`,
  },
}))

function BucketFields({ add = false }) {
  const classes = useBucketFieldsStyles()
  return (
    <M.Box>
      <M.Box className={classes.group} mt={-1} pb={2}>
        <RF.Field
          component={Form.Field}
          name="name"
          label="Name"
          placeholder="Enter an S3 bucket name"
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
          select
          name="region"
          label="Region"
          validate={[validators.required]}
          errors={{
            required: "Select bucket's region",
          }}
          fullWidth
          margin="normal"
          renderValue={(v) => (v ? `${v} / ${REGIONS[v]}` : null)}
        >
          {Object.entries(REGIONS).map(([key, name]) => (
            <M.MenuItem key={key} value={key}>
              {key} / {name}
            </M.MenuItem>
          ))}
        </RF.Field>
        <RF.Field
          component={Form.Field}
          name="title"
          label="Title"
          placeholder='e.g. "Production analytics data"'
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
          placeholder="e.g. https://some-cdn.com/icon.png"
          normalize={R.pipe(R.trim, R.take(1024))}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="description"
          label="Description"
          normalize={R.pipe(R.replace(/^\s+/g, ''), R.take(1024))}
          multiline
          rows={1}
          rowsMax={3}
          fullWidth
          margin="normal"
        />
      </M.Box>
      <M.ExpansionPanel elevation={0} className={classes.panel}>
        <M.ExpansionPanelSummary
          expandIcon={<M.Icon>expand_more</M.Icon>}
          classes={{
            root: classes.panelSummary,
            content: classes.panelSummaryContent,
          }}
        >
          <M.Typography variant="h6">Metadata</M.Typography>
        </M.ExpansionPanelSummary>
        <M.Box className={classes.group} pt={1} pb={2}>
          <RF.Field
            component={Form.Field}
            name="relevanceScore"
            label="Relevance score"
            placeholder="-1 to hide, 0 to sort first, 1 or higher to sort later"
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
            name="tags"
            label="Tags (comma-separated)"
            placeholder='e.g. "geospatial", for bucket discovery'
            fullWidth
            margin="normal"
            multiline
            rows={1}
            maxRows={3}
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
            name="linkedData"
            label="Structured data (JSON-LD)"
            validate={[validators.jsonObject]}
            errors={{
              jsonObject: 'Must be a valid JSON object',
            }}
            fullWidth
            multiline
            rows={1}
            rowsMax={10}
            margin="normal"
          />
        </M.Box>
      </M.ExpansionPanel>
      <M.ExpansionPanel elevation={0} className={classes.panel}>
        <M.ExpansionPanelSummary
          expandIcon={<M.Icon>expand_more</M.Icon>}
          classes={{
            root: classes.panelSummary,
            content: classes.panelSummaryContent,
          }}
        >
          <M.Typography variant="h6">Indexing and notifications</M.Typography>
        </M.ExpansionPanelSummary>
        <M.Box className={classes.group} pt={1}>
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
      </M.ExpansionPanel>
    </M.Box>
  )
}

const formToJSON = (values) => {
  const isMissing = (v) => v == null || v === '' || Number.isNaN(v)
  const get = (key, onValue = R.identity, onMissing) => {
    const v = values.get(key)
    return isMissing(v) ? onMissing : onValue(v)
  }
  const json = {
    name: get('name'),
    title: get('title', R.trim),
    icon_url: get('iconUrl', R.identity),
    description: get('description', R.trim),
    relevance_score: get('relevanceScore', Number),
    overview_url: get('overviewUrl'),
    tags: get(
      'tags',
      R.pipe(
        R.split(','),
        R.map(R.trim),
        R.reject((t) => !t),
        R.uniq,
      ),
    ),
    schema_org: get('linkedData', JSON.parse),
    file_extensions_to_index: get(
      'fileExtensionsToIndex',
      R.pipe(
        R.split(','),
        R.map(R.trim),
        R.reject((t) => !t),
        R.uniq,
      ),
    ),
    scanner_parallel_shards_depth: get('scannerParallelShardsDepth', Number),
    sns_notification_arn: get('snsNotificationArn', R.trim),
    skip_meta_data_indexing: get('skipMetaDataIndexing'),
    delay_scan: get('delayScan'),
  }
  return R.reject(isMissing, json)
}

function Add({ close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const { push } = Notifications.use()
  const t = useTracker()
  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const res = await req({
          endpoint: '/admin/buckets',
          method: 'POST',
          body: JSON.stringify(formToJSON(values)),
        })
        const b = data.bucketFromJSON(res)
        cache.patchOk(data.BucketsResource, null, R.append(b))
        push(`Bucket "${b.name}" added`)
        t.track('WEB', { type: 'admin', action: 'bucket add', bucket: b.name })
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
    <Form.ReduxForm
      form="Admin.Buckets.Add"
      onSubmit={onSubmit}
      initialValues={{ region: DEFAULT_REGION }}
    >
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
            {submitting && (
              <Delay>
                {() => (
                  <M.Box flexGrow={1} display="flex" pl={2}>
                    <M.CircularProgress size={24} />
                  </M.Box>
                )}
              </Delay>
            )}
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
              Add
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
          body: JSON.stringify(formToJSON(values)),
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

  const initialValues = {
    name: bucket.name,
    title: bucket.title,
    region: bucket.region,
    iconUrl: bucket.iconUrl,
    description: bucket.description,
    relevanceScore: bucket.relevanceScore,
    overviewUrl: bucket.overviewUrl,
    tags: (bucket.tags || []).join(', '),
    linkedData: bucket.linkedData ? JSON.stringify(bucket.linkedData) : undefined,
    fileExtensionsToIndex: (bucket.fileExtensionsToIndex || []).join(', '),
    scannerParallelShardsDepth: bucket.scannerParallelShardsDepth,
    snsNotificationArn: bucket.snsNotificationArn,
    skipMetaDataIndexing: bucket.skipMetaDataIndexing,
  }

  return (
    <Form.ReduxForm
      form={`Admin.Buckets.Edit(${bucket.name})`}
      onSubmit={onSubmit}
      initialValues={initialValues}
    >
      {({ handleSubmit, submitting, submitFailed, error, invalid, pristine, reset }) => (
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
            {submitting && (
              <Delay>
                {() => (
                  <M.Box flexGrow={1} display="flex" pl={2}>
                    <M.CircularProgress size={24} />
                  </M.Box>
                )}
              </Delay>
            )}
            <M.Button
              onClick={() => reset()}
              color="primary"
              disabled={pristine || submitting}
            >
              Reset
            </M.Button>
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
              disabled={pristine || submitting || (submitFailed && invalid)}
            >
              Save
            </M.Button>
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
  const t = useTracker()
  const doDelete = React.useCallback(async () => {
    close()
    try {
      // optimistically remove the bucket from cache
      cache.patchOk(data.BucketsResource, null, R.reject(R.propEq('name', bucket.name)))
      await req({ endpoint: `/admin/buckets/${bucket.name}`, method: 'DELETE' })
      t.track('WEB', { type: 'admin', action: 'bucket delete', bucket: bucket.name })
    } catch (e) {
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

const columns = [
  {
    id: 'name',
    label: 'Name (relevance)',
    getValue: R.prop('name'),
    getDisplay: (v, b) => (
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
    id: 'region',
    label: 'Region',
    getValue: R.prop('region'),
    getDisplay: (v) =>
      v ? (
        <M.Box fontFamily="monospace.fontFamily" component="span">
          {v}
        </M.Box>
      ) : (
        <M.Box color="text.secondary" component="span">
          {'<Not set>'}
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
        dialogs.open(({ close }) => <Add {...{ close }} />)
      }, [dialogs.open]),
    },
  ]

  const edit = (bucket) => () =>
    dialogs.open(({ close }) => <Edit {...{ bucket, close }} />)

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
      fn: edit(bucket),
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
              <M.TableRow
                hover
                key={i.name}
                onClick={edit(i)}
                style={{ cursor: 'pointer' }}
              >
                {columns.map((col) => (
                  <M.TableCell key={col.id} align={col.align} {...col.props}>
                    {(col.getDisplay || R.identity)(col.getValue(i), i)}
                  </M.TableCell>
                ))}
                <M.TableCell
                  align="right"
                  padding="none"
                  onClick={(e) => e.stopPropagation()}
                >
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
