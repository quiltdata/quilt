import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as RF from 'redux-form/es/immutable'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import Delay from 'utils/Delay'
import * as Dialogs from 'utils/Dialogs'
import * as Cache from 'utils/ResourceCache'
import { useTracker } from 'utils/tracking'
import * as validators from 'utils/validators'

import * as Form from './Form'
import * as Table from './Table'
import * as data from './data'

// default icon as returned by the registry
const DEFAULT_ICON = 'https://d1zvn9rasera71.cloudfront.net/q-128-square.png'

const DO_NOT_SUBSCRIBE_STR = 'DO_NOT_SUBSCRIBE'
const DO_NOT_SUBSCRIBE_SYM = Symbol(DO_NOT_SUBSCRIBE_STR)

const SNS_ARN_RE = /^arn:aws(-|\w)*:sns:(-|\w)*:\d*:\S+$/

function validateSNS(v) {
  if (!v) return undefined
  if (v === DO_NOT_SUBSCRIBE_SYM) return undefined
  return SNS_ARN_RE.test(v) ? undefined : 'invalidArn'
}

const snsErrors = {
  invalidArn: 'Enter a valid SNS topic ARN or leave blank',
  topicNotFound: 'No such topic, enter a valid SNS topic ARN or leave blank',
}

function SNSField({ input: { onChange, value = '' }, meta }) {
  const error = meta.submitFailed && meta.error

  const handleSkipChange = React.useCallback(
    (e, checked) => {
      onChange(checked ? DO_NOT_SUBSCRIBE_SYM : '')
    },
    [onChange],
  )

  const handleArnChange = React.useCallback(
    (e) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  return (
    <M.Box mt={2}>
      <Form.Checkbox
        meta={meta}
        checked={value === DO_NOT_SUBSCRIBE_SYM}
        onChange={handleSkipChange}
        label="Skip S3 notifications (not recommended)"
      />
      <M.TextField
        error={!!error}
        helperText={error ? snsErrors[error] || error : undefined}
        label="SNS Topic ARN"
        placeholder="Enter ARN (leave blank to auto-fill)"
        fullWidth
        margin="normal"
        disabled={
          value === DO_NOT_SUBSCRIBE_SYM || meta.submitting || meta.submitSucceeded
        }
        onChange={handleArnChange}
        value={value === DO_NOT_SUBSCRIBE_SYM ? DO_NOT_SUBSCRIBE_STR : value}
        InputLabelProps={{ shrink: true }}
      />
    </M.Box>
  )
}

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

function BucketFields({ add = false, reindex }) {
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
            noSuchBucket: 'No such bucket',
          }}
          fullWidth
          margin="normal"
        />
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
          label="Icon URL (optional, defaults to Quilt logo)"
          placeholder="e.g. https://some-cdn.com/icon.png"
          helperText="Recommended size: 80x80px"
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
      <M.Accordion elevation={0} className={classes.panel}>
        <M.AccordionSummary
          expandIcon={<M.Icon>expand_more</M.Icon>}
          classes={{
            root: classes.panelSummary,
            content: classes.panelSummaryContent,
          }}
        >
          <M.Typography variant="h6">Metadata</M.Typography>
        </M.AccordionSummary>
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
      </M.Accordion>
      <M.Accordion elevation={0} className={classes.panel}>
        <M.AccordionSummary
          expandIcon={<M.Icon>expand_more</M.Icon>}
          classes={{
            root: classes.panelSummary,
            content: classes.panelSummaryContent,
          }}
        >
          <M.Typography variant="h6">Indexing and notifications</M.Typography>
        </M.AccordionSummary>
        <M.Box className={classes.group} pt={1}>
          {!!reindex && (
            <M.Button variant="outlined" fullWidth onClick={reindex}>
              Re-index and repair
            </M.Button>
          )}
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
            component={SNSField}
            name="snsNotificationArn"
            validate={validateSNS}
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
      </M.Accordion>
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
    sns_notification_arn: get('snsNotificationArn', (v) => {
      if (v === DO_NOT_SUBSCRIBE_SYM) return DO_NOT_SUBSCRIBE_STR
      if (typeof v === 'string') return v.trim()
      return undefined
    }),
    skip_meta_data_indexing: get('skipMetaDataIndexing'),
    delay_scan: get('delayScan'),
  }
  return R.reject(isMissing, json)
}

const toBucketConfig = (b) => ({
  name: b.name,
  title: b.title,
  iconUrl: b.iconUrl || DEFAULT_ICON,
  description: b.description,
  overviewUrl: b.overviewUrl,
  linkedData: b.linkedData,
  tags: b.tags,
  relevance: b.relevanceScore,
})

function useAuthSession() {
  const cfg = Config.use()
  const sessionId = redux.useSelector(AuthSelectors.sessionId)
  return cfg.alwaysRequiresAuth && sessionId
}

function Add({ close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const session = useAuthSession()
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
        cache.patchOk(
          BucketConfig.BucketsResource,
          { empty: false, session },
          R.append(toBucketConfig(b)),
          true,
        )
        push(`Bucket "${b.name}" added`)
        t.track('WEB', { type: 'admin', action: 'bucket add', bucket: b.name })
        close()
      } catch (e) {
        if (APIConnector.HTTPError.is(e, 409, /Bucket already added/)) {
          throw new RF.SubmissionError({ name: 'conflict' })
        }
        if (APIConnector.HTTPError.is(e, 404, /NoSuchBucket/)) {
          throw new RF.SubmissionError({ name: 'noSuchBucket' })
        }
        if (APIConnector.HTTPError.is(e, 401, /404 - NotFound: Topic does not exist/)) {
          throw new RF.SubmissionError({ snsNotificationArn: 'topicNotFound' })
        }
        // eslint-disable-next-line no-console
        console.error('Error adding bucket')
        // eslint-disable-next-line no-console
        console.dir(e)
        throw new RF.SubmissionError({ _error: 'unexpected' })
      }
    },
    [req, cache, push, close, session, t],
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

function Reindex({ bucket, open, close }) {
  const req = APIConnector.use()

  const [repair, setRepair] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitSucceeded, setSubmitSucceeded] = React.useState(false)
  const [error, setError] = React.useState(false)

  const reset = React.useCallback(() => {
    setSubmitting(false)
    setSubmitSucceeded(false)
    setRepair(false)
    setError(false)
  }, [])

  const handleRepairChange = React.useCallback((e, v) => {
    setRepair(v)
  }, [])

  const reindex = React.useCallback(async () => {
    if (submitting) return
    setError(false)
    setSubmitting(true)
    try {
      await req({
        endpoint: `/admin/reindex/${bucket}`,
        method: 'POST',
        body: { repair: repair || undefined },
      })
      setSubmitSucceeded(true)
    } catch (e) {
      if (APIConnector.HTTPError.is(e, 404, 'Bucket not found')) {
        setError('Bucket not found')
      } else if (APIConnector.HTTPError.is(e, 409, /in progress/)) {
        setError('Indexing already in progress')
      } else {
        // eslint-disable-next-line no-console
        console.log('Error re-indexing bucket:')
        // eslint-disable-next-line no-console
        console.error(e)
        setError('Unexpected error')
      }
    }
    setSubmitting(false)
  }, [submitting, req, bucket, repair])

  const handleClose = React.useCallback(() => {
    if (submitting) return
    close()
  }, [submitting, close])

  return (
    <M.Dialog open={open} onClose={handleClose} onExited={reset} fullWidth>
      <M.DialogTitle>Re-index and repair a bucket</M.DialogTitle>
      {submitSucceeded ? (
        <M.DialogContent>
          <M.DialogContentText color="textPrimary">
            We have {repair && <>repaired S3 notifications and </>}
            started re-indexing the bucket.
          </M.DialogContentText>
        </M.DialogContent>
      ) : (
        <M.DialogContent>
          <M.DialogContentText color="textPrimary">
            You are about to start re-indexing the <b>&quot;{bucket}&quot;</b> bucket
          </M.DialogContentText>
          <Form.Checkbox
            meta={{ submitting, submitSucceeded }}
            input={{ checked: repair, onChange: handleRepairChange }}
            label="Repair S3 notifications"
          />
          {repair && (
            <M.Box color="warning.dark" ml={4}>
              <M.Typography color="inherit" variant="caption">
                Bucket notifications will be overwritten
              </M.Typography>
            </M.Box>
          )}
        </M.DialogContent>
      )}
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
        {!submitting && !!error && (
          <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
            <M.Icon color="error">error_outline</M.Icon>
            <M.Box pl={1} />
            <M.Typography variant="body2" color="error">
              {error}
            </M.Typography>
          </M.Box>
        )}

        {submitSucceeded ? (
          <>
            <M.Button onClick={close} color="primary">
              Close
            </M.Button>
          </>
        ) : (
          <>
            <M.Button onClick={close} disabled={submitting} color="primary">
              Cancel
            </M.Button>
            <M.Button onClick={reindex} disabled={submitting} color="primary">
              Re-index
              {repair && <> and repair</>}
            </M.Button>
          </>
        )}
      </M.DialogActions>
    </M.Dialog>
  )
}

function Edit({ bucket, close }) {
  const req = APIConnector.use()
  const cache = Cache.use()
  const session = useAuthSession()

  const [reindexOpen, setReindexOpen] = React.useState(false)
  const openReindex = React.useCallback(() => setReindexOpen(true), [])
  const closeReindex = React.useCallback(() => setReindexOpen(false), [])

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
        cache.patchOk(
          BucketConfig.BucketsResource,
          { empty: false, session },
          R.map((b) => (b.name === bucket.name ? toBucketConfig(updated) : b)),
          true,
        )
        close()
      } catch (e) {
        if (APIConnector.HTTPError.is(e, 401, /404 - NotFound: Topic does not exist/)) {
          throw new RF.SubmissionError({ snsNotificationArn: 'topicNotFound' })
        }
        // eslint-disable-next-line no-console
        console.error('Error updating bucket')
        // eslint-disable-next-line no-console
        console.dir(e)
        throw new RF.SubmissionError({ _error: 'unexpected' })
      }
    },
    [req, cache, close, session, bucket.name],
  )

  const initialValues = {
    name: bucket.name,
    title: bucket.title,
    iconUrl: bucket.iconUrl,
    description: bucket.description,
    relevanceScore: bucket.relevanceScore,
    overviewUrl: bucket.overviewUrl,
    tags: (bucket.tags || []).join(', '),
    linkedData: bucket.linkedData ? JSON.stringify(bucket.linkedData) : undefined,
    fileExtensionsToIndex: (bucket.fileExtensionsToIndex || []).join(', '),
    scannerParallelShardsDepth: bucket.scannerParallelShardsDepth,
    snsNotificationArn:
      bucket.snsNotificationArn === DO_NOT_SUBSCRIBE_STR
        ? DO_NOT_SUBSCRIBE_SYM
        : bucket.snsNotificationArn,
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
          <Reindex bucket={bucket.name} open={reindexOpen} close={closeReindex} />
          <M.DialogTitle>Edit the &quot;{bucket.name}&quot; bucket</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <BucketFields reindex={openReindex} />
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
  const session = useAuthSession()
  const { push } = Notifications.use()
  const t = useTracker()
  const doDelete = React.useCallback(async () => {
    close()
    try {
      // optimistically remove the bucket from cache
      cache.patchOk(data.BucketsResource, null, R.reject(R.propEq('name', bucket.name)))
      cache.patchOk(
        BucketConfig.BucketsResource,
        { empty: false, session },
        R.reject(R.propEq('name', bucket.name)),
        true,
      )
      await req({ endpoint: `/admin/buckets/${bucket.name}`, method: 'DELETE' })
      t.track('WEB', { type: 'admin', action: 'bucket delete', bucket: bucket.name })
    } catch (e) {
      // put the bucket back into cache if it hasnt been deleted properly
      cache.patchOk(data.BucketsResource, null, R.append(bucket))
      cache.patchOk(
        BucketConfig.BucketsResource,
        { empty: false, session },
        R.append(toBucketConfig(bucket)),
        true,
      )
      push(`Error deleting bucket "${bucket.name}"`)
      // eslint-disable-next-line no-console
      console.error('Error deleting bucket')
      // eslint-disable-next-line no-console
      console.dir(e)
    }
  }, [bucket, close, req, cache, push, session, t])

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
    id: 'icon',
    label: 'Icon',
    sortable: false,
    align: 'center',
    getValue: R.prop('iconUrl'),
    getDisplay: (v) => (
      <M.Box
        component="img"
        src={v || DEFAULT_ICON}
        alt=""
        title={v ? undefined : 'Default icon'}
        height={40}
        width={40}
        mt={-0.25}
        mb={-0.25}
        style={{ opacity: v ? undefined : 0.7 }}
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
  const { open: openDialog, render: renderDialogs } = Dialogs.use()

  const toolbarActions = [
    {
      title: 'Add bucket',
      icon: <M.Icon>add</M.Icon>,
      fn: React.useCallback(() => {
        openDialog(({ close }) => <Add {...{ close }} />)
      }, [openDialog]),
    },
  ]

  const edit = (bucket) => () =>
    openDialog(({ close }) => <Edit {...{ bucket, close }} />)

  const inlineActions = (bucket) => [
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
