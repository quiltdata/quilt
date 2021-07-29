import * as dateFns from 'date-fns'
import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as IO from 'io-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RRDom from 'react-router-dom'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'
import * as Pagination from 'components/Pagination'
import * as Notifications from 'containers/Notifications'
import * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import Delay from 'utils/Delay'
import * as Dialogs from 'utils/Dialogs'
import type FormSpec from 'utils/FormSpec'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import parseSearch from 'utils/parseSearch'
import { useTracker } from 'utils/tracking'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'

import * as Form from './Form'
import * as Table from './Table'

import BUCKET_CONFIGS_QUERY from './BucketConfigs.generated'
import ADD_MUTATION from './BucketsAdd.generated'
import UPDATE_MUTATION from './BucketsUpdate.generated'
import REMOVE_MUTATION from './BucketsRemove.generated'
import { BucketConfigSelectionFragment as BucketConfig } from './BucketConfigSelection.generated'

const SNS_ARN_RE = /^arn:aws(-|\w)*:sns:(-|\w)*:\d*:\S+$/

const DO_NOT_SUBSCRIBE_STR = 'DO_NOT_SUBSCRIBE'
const DO_NOT_SUBSCRIBE_SYM = Symbol(DO_NOT_SUBSCRIBE_STR)

type SnsFormValue = string | typeof DO_NOT_SUBSCRIBE_SYM
// eslint-disable-next-line @typescript-eslint/no-redeclare
const SnsFormValue = new IO.Type<SnsFormValue>(
  'SnsFormValue',
  (i): i is SnsFormValue => i === DO_NOT_SUBSCRIBE_SYM || IO.string.is(i),
  (u, c) =>
    u === DO_NOT_SUBSCRIBE_SYM || typeof u === 'string'
      ? IO.success(u)
      : IO.failure(u, c),
  R.identity,
)

const editFormSpec: FormSpec<Model.GQLTypes.BucketUpdateInput> = {
  title: R.pipe(
    R.prop('title'),
    Types.decode(IO.string),
    R.trim,
    Types.decode(Types.NonEmptyString),
  ),
  iconUrl: R.pipe(
    R.prop('iconUrl'),
    Types.decode(Types.fromNullable(IO.string, '')),
    R.trim,
    (s) => (s ? (s as Types.NonEmptyString) : null),
  ),
  description: R.pipe(
    R.prop('description'),
    Types.decode(Types.fromNullable(IO.string, '')),
    R.trim,
    (s) => (s ? (s as Types.NonEmptyString) : null),
  ),
  relevanceScore: R.pipe(
    R.prop('relevanceScore'),
    Types.decode(Types.fromNullable(IO.string, '')),
    (s) => s || null,
    Types.decode(Types.nullable(Types.IntFromString)),
  ),
  overviewUrl: R.pipe(
    R.prop('overviewUrl'),
    Types.decode(Types.fromNullable(IO.string, '')),
    R.trim,
    (s) => (s ? (s as Types.NonEmptyString) : null),
  ),
  tags: R.pipe(
    R.prop('tags'),
    Types.decode(Types.fromNullable(IO.string, '')),
    R.split(','),
    R.map(R.trim),
    R.reject((t) => !t),
    R.uniq,
    (tags) =>
      tags.length ? (tags as FP.nonEmptyArray.NonEmptyArray<Types.NonEmptyString>) : null,
  ),
  linkedData: R.pipe(
    R.prop('linkedData'),
    Types.decode(Types.fromNullable(IO.string, '')),
    (s) => s.trim() || 'null',
    Types.decode(Types.withFallback(Types.JsonFromString, null)),
  ),
  fileExtensionsToIndex: R.pipe(
    R.prop('fileExtensionsToIndex'),
    Types.decode(Types.fromNullable(IO.string, '')),
    R.split(','),
    R.map(R.trim),
    R.reject((t) => !t),
    R.uniq,
    (exts) =>
      exts.length ? (exts as FP.nonEmptyArray.NonEmptyArray<Types.NonEmptyString>) : null,
  ),
  scannerParallelShardsDepth: R.pipe(
    R.prop('scannerParallelShardsDepth'),
    Types.decode(Types.fromNullable(IO.string, '')),
    (s) => s || null,
    Types.decode(Types.nullable(Types.IntFromString)),
  ),
  snsNotificationArn: R.pipe(
    R.prop('snsNotificationArn'),
    Types.decode(Types.nullable(SnsFormValue)),
    (v) => {
      if (v === DO_NOT_SUBSCRIBE_SYM) return DO_NOT_SUBSCRIBE_STR as Types.NonEmptyString
      const trimmed = v?.trim()
      if (trimmed) return trimmed as Types.NonEmptyString
      return null
    },
  ),
  skipMetaDataIndexing: R.pipe(
    R.prop('skipMetaDataIndexing'),
    Types.decode(Types.fromNullable(IO.boolean, false)),
  ),
  setVersioning: () => null,
}

const addFormSpec: FormSpec<Model.GQLTypes.BucketAddInput> = {
  ...editFormSpec,
  name: R.pipe(
    R.prop('name'),
    Types.decode(IO.string),
    R.trim,
    Types.decode(Types.NonEmptyString),
  ),
  delayScan: R.pipe(
    R.prop('delayScan'),
    Types.decode(Types.fromNullable(IO.boolean, false)),
  ),
}

function validateSns(v: SnsFormValue) {
  if (!v) return undefined
  if (v === DO_NOT_SUBSCRIBE_SYM) return undefined
  return SNS_ARN_RE.test(v) ? undefined : 'invalidArn'
}

const snsErrors = {
  invalidArn: 'Enter a valid SNS topic ARN or leave blank',
  topicNotFound: 'No such topic, enter a valid SNS topic ARN or leave blank',
  configurationError: 'Notification configuration error',
}

function SnsField({
  input: { onChange, value = '' },
  meta,
}: RF.FieldRenderProps<SnsFormValue>) {
  const error = meta.submitFailed && (meta.error || meta.submitError)

  const handleSkipChange = React.useCallback(
    (_e, checked) => {
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
        helperText={error ? (snsErrors as $TSFixMe)[error] || error : undefined}
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

interface BucketFieldsProps {
  name?: string
  reindex?: () => void
}

function BucketFields({ name, reindex }: BucketFieldsProps) {
  const classes = useBucketFieldsStyles()
  return (
    <M.Box>
      <M.Box className={classes.group} mt={-1} pb={2}>
        {name ? (
          <M.TextField label="Name" value={name} fullWidth margin="normal" disabled />
        ) : (
          <RF.Field
            component={Form.Field}
            name="name"
            label="Name"
            placeholder="Enter an S3 bucket name"
            parse={R.pipe(
              R.toLower,
              R.replace(/[^a-z0-9-.]/g, ''),
              R.take(63) as (s: string) => string,
            )}
            validate={validators.required as FF.FieldValidator<any>}
            errors={{
              required: 'Enter a bucket name',
              conflict: 'Bucket already added',
              noSuchBucket: 'No such bucket',
            }}
            fullWidth
            margin="normal"
          />
        )}
        <RF.Field
          component={Form.Field}
          name="title"
          label="Title"
          placeholder='e.g. "Production analytics data"'
          parse={R.pipe(R.replace(/^\s+/g, ''), R.take(256) as (s: string) => string)}
          validate={validators.required as FF.FieldValidator<any>}
          errors={{
            required: 'Enter a bucket title',
          }}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="iconUrl"
          label="Icon URL (optional)"
          placeholder="e.g. https://some-cdn.com/icon.png"
          helperText="Recommended size: 80x80px"
          parse={R.pipe(R.trim, R.take(1024) as (s: string) => string)}
          fullWidth
          margin="normal"
        />
        <RF.Field
          component={Form.Field}
          name="description"
          label="Description"
          parse={R.pipe(R.replace(/^\s+/g, ''), R.take(1024) as (s: string) => string)}
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
            parse={R.pipe(
              R.replace(/[^0-9-]/g, ''),
              R.replace(/(.+)-+$/g, '$1'),
              R.take(16) as (s: string) => string,
            )}
            validate={validators.integer as FF.FieldValidator<any>}
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
            rowsMax={3}
          />
          <RF.Field
            component={Form.Field}
            name="overviewUrl"
            label="Overview URL"
            parse={R.trim}
            fullWidth
            margin="normal"
          />
          <RF.Field
            component={Form.Field}
            name="linkedData"
            label="Structured data (JSON-LD)"
            validate={validators.jsonObject as FF.FieldValidator<any>}
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
            validate={validators.integer as FF.FieldValidator<any>}
            errors={{
              integer: 'Enter a valid integer',
            }}
            parse={R.pipe(R.replace(/[^0-9]/g, ''), R.take(16) as (s: string) => string)}
            fullWidth
            margin="normal"
          />
          <RF.Field
            component={SnsField}
            name="snsNotificationArn"
            validate={validateSns}
          />
          <M.Box mt={2}>
            <RF.Field
              component={Form.Checkbox}
              type="checkbox"
              name="skipMetaDataIndexing"
              label="Skip metadata indexing"
            />
          </M.Box>
          {!name && (
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

interface AddProps {
  close: (reason?: string) => void
}

function Add({ close }: AddProps) {
  const { push } = Notifications.use()
  const t = useTracker()
  const [, add] = urql.useMutation(ADD_MUTATION)
  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const input = R.applySpec(addFormSpec)(values)
        const res = await add({ input })
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.bucketAdd
        switch (r.__typename) {
          case 'BucketAddSuccess':
            push(`Bucket "${r.bucketConfig.name}" added`)
            t.track('WEB', {
              type: 'admin',
              action: 'bucket add',
              bucket: r.bucketConfig.name,
            })
            close()
            return undefined
          case 'BucketAlreadyAdded':
            return { name: 'conflict' }
          case 'BucketDoesNotExist':
            return { name: 'noSuchBucket' }
          case 'SnsInvalid':
            // shouldnt happen since we're validating it
            return { snsNotificationArn: 'invalidArn' }
          case 'NotificationTopicNotFound':
            return { snsNotificationArn: 'topicNotFound' }
          case 'NotificationConfigurationError':
            return {
              snsNotificationArn: 'configurationError',
              [FF.FORM_ERROR]: 'notificationConfigurationError',
            }
          case 'InsufficientPermissions':
            return { [FF.FORM_ERROR]: 'insufficientPermissions' }
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error adding bucket')
        // eslint-disable-next-line no-console
        console.error(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [add, push, close, t],
  )

  return (
    <RF.Form onSubmit={onSubmit}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
      }) => (
        <>
          <M.DialogTitle>Add a bucket</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <BucketFields />
              {submitFailed && (
                <Form.FormError
                  error={error || submitError}
                  errors={{
                    unexpected: 'Something went wrong',
                    notificationConfigurationError: 'Notification configuration error',
                    insufficientPermissions: 'Insufficient permissions',
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
              disabled={submitting || (submitFailed && hasValidationErrors)}
            >
              Add
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

interface ReindexProps {
  bucket: string
  open: boolean
  close: () => void
}

function Reindex({ bucket, open, close }: ReindexProps) {
  const req = APIConnector.use()

  const [repair, setRepair] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitSucceeded, setSubmitSucceeded] = React.useState(false)
  const [error, setError] = React.useState<string | false>(false)

  const reset = React.useCallback(() => {
    setSubmitting(false)
    setSubmitSucceeded(false)
    setRepair(false)
    setError(false)
  }, [])

  const handleRepairChange = React.useCallback((_e, v) => {
    setRepair(v)
  }, [])

  const reindex = React.useCallback(async () => {
    if (submitting) return
    setError(false)
    setSubmitting(true)
    try {
      // TODO: use graphql mutation
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

interface EditProps {
  bucket: BucketConfig
  close: (reason?: string) => void
}

function Edit({ bucket, close }: EditProps) {
  const [, update] = urql.useMutation(UPDATE_MUTATION)

  const [reindexOpen, setReindexOpen] = React.useState(false)
  const openReindex = React.useCallback(() => setReindexOpen(true), [])
  const closeReindex = React.useCallback(() => setReindexOpen(false), [])

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const input = R.applySpec(editFormSpec)(values)
        const res = await update({ name: bucket.name, input })
        if (res.error) throw res.error
        if (!res.data) throw new Error('No data')
        const r = res.data.bucketUpdate
        switch (r.__typename) {
          case 'BucketUpdateSuccess':
            close()
            return undefined
          case 'SnsInvalid':
            // shouldnt happen since we're validating it
            return { snsNotificationArn: 'invalidArn' }
          case 'NotificationTopicNotFound':
            return { snsNotificationArn: 'topicNotFound' }
          case 'NotificationConfigurationError':
            return {
              snsNotificationArn: 'configurationError',
              [FF.FORM_ERROR]: 'notificationConfigurationError',
            }
          case 'BucketNotFound':
            return { [FF.FORM_ERROR]: 'bucketNotFound' }
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating bucket')
        // eslint-disable-next-line no-console
        console.error(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [update, close, bucket.name],
  )

  const initialValues = {
    title: bucket.title,
    iconUrl: bucket.iconUrl || '',
    description: bucket.description || '',
    relevanceScore: bucket.relevanceScore.toString(),
    overviewUrl: bucket.overviewUrl || '',
    tags: (bucket.tags || []).join(', '),
    linkedData: bucket.linkedData ? JSON.stringify(bucket.linkedData) : '',
    fileExtensionsToIndex: (bucket.fileExtensionsToIndex || []).join(', '),
    scannerParallelShardsDepth: bucket.scannerParallelShardsDepth?.toString() || '',
    snsNotificationArn: bucket.snsNotificationArn || DO_NOT_SUBSCRIBE_SYM,
    skipMetaDataIndexing: bucket.skipMetaDataIndexing ?? false,
  }

  return (
    <RF.Form onSubmit={onSubmit} initialValues={initialValues}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
        pristine,
        form,
      }) => (
        <>
          <Reindex bucket={bucket.name} open={reindexOpen} close={closeReindex} />
          <M.DialogTitle>Edit the &quot;{bucket.name}&quot; bucket</M.DialogTitle>
          <M.DialogContent>
            <form onSubmit={handleSubmit}>
              <BucketFields name={bucket.name} reindex={openReindex} />
              {submitFailed && (
                <Form.FormError
                  error={error || submitError}
                  errors={{
                    unexpected: 'Something went wrong',
                    notificationConfigurationError: 'Notification configuration error',
                    bucketNotFound: 'Bucket not found',
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
              onClick={() => form.reset()}
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
              disabled={pristine || submitting || (submitFailed && hasValidationErrors)}
            >
              Save
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </RF.Form>
  )
}

interface DeleteProps {
  bucket: BucketConfig
  close: (reason?: string) => void
}

function Delete({ bucket, close }: DeleteProps) {
  const { push } = Notifications.use()
  const t = useTracker()
  const [, rm] = urql.useMutation(REMOVE_MUTATION)
  const doDelete = React.useCallback(async () => {
    close()
    try {
      const res = await rm({ name: bucket.name })
      if (res.error) throw res.error
      if (!res.data) throw new Error('No data')
      const r = res.data.bucketRemove
      switch (r.__typename) {
        case 'BucketRemoveSuccess':
          t.track('WEB', { type: 'admin', action: 'bucket delete', bucket: bucket.name })
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
  }, [bucket, close, rm, push, t])

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

const columns = [
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

interface CRUDProps {
  bucketName?: string
}

function CRUD({ bucketName }: CRUDProps) {
  const [{ data }] = urql.useQuery({ query: BUCKET_CONFIGS_QUERY })
  const rows = data!.bucketConfigs
  const ordering = Table.useOrdering({ rows, column: columns[0] })
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
        // @ts-expect-error
        openDialog(({ close }) => <Add {...{ close }} />)
      }, [openDialog]),
    },
  ]

  const edit = (bucket: BucketConfig) => () => {
    history.push(urls.adminBuckets(bucket.name))
  }

  const inlineActions = (bucket: BucketConfig) => [
    {
      title: 'Delete',
      icon: <M.Icon>delete</M.Icon>,
      fn: () => {
        // @ts-expect-error
        openDialog(({ close }) => <Delete {...{ bucket, close }} />)
      },
    },
    {
      title: 'Edit',
      icon: <M.Icon>edit</M.Icon>,
      fn: edit(bucket),
    },
  ]

  const editingBucket = React.useMemo(
    () => (bucketName ? rows.find(({ name }) => name === bucketName) : null),
    [bucketName, rows],
  )

  const onBucketClose = React.useCallback(() => {
    history.push(urls.adminBuckets())
  }, [history, urls])

  if (bucketName && !editingBucket) {
    // Bucket name set in URL, but it was not found in buckets list
    return <RRDom.Redirect to={urls.adminBuckets()} />
  }

  return (
    <M.Paper>
      {renderDialogs({ maxWidth: 'xs', fullWidth: true })}

      <M.Dialog open={!!editingBucket} fullWidth maxWidth="xs">
        {editingBucket && <Edit bucket={editingBucket} close={onBucketClose} />}
      </M.Dialog>

      <Table.Toolbar heading="Buckets" actions={toolbarActions} />
      <Table.Wrapper>
        <M.Table size="small">
          <Table.Head columns={columns} ordering={ordering} withInlineActions />
          <M.TableBody>
            {pagination.paginated.map((i: BucketConfig) => (
              <M.TableRow
                hover
                key={i.name}
                onClick={edit(i)}
                style={{ cursor: 'pointer' }}
              >
                {columns.map((col) => (
                  // @ts-expect-error
                  <M.TableCell key={col.id} align={col.align} {...col.props}>
                    {/* @ts-expect-error */}
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

export default function Buckets({ location }: RRDom.RouteComponentProps) {
  const { bucket } = parseSearch(location.search)
  const bucketName = Array.isArray(bucket) ? bucket[0] : bucket
  return (
    <M.Box mt={2} mb={2}>
      <MetaTitle>{['Buckets', 'Admin']}</MetaTitle>
      <React.Suspense
        fallback={
          <M.Paper>
            <Table.Toolbar heading="Buckets" />
            <Table.Progress />
          </M.Paper>
        }
      >
        <CRUD bucketName={bucketName} />
      </React.Suspense>
    </M.Box>
  )
}
