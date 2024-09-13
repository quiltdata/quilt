import cx from 'classnames'
import * as FF from 'final-form'
import arrayMutators from 'final-form-arrays'
import * as FP from 'fp-ts'
import * as IO from 'io-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RRDom from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Buttons from 'components/Buttons'
import * as Dialog from 'components/Dialog'
import JsonDisplay from 'components/JsonDisplay'
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import Delay from 'utils/Delay'
import type FormSpec from 'utils/FormSpec'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import StyledTooltip from 'utils/StyledTooltip'
import assertNever from 'utils/assertNever'
import { formatQuantity } from 'utils/string'
import { useTracker } from 'utils/tracking'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'
import * as yaml from 'utils/yaml'

import * as Form from '../Form'
import LongQueryConfigForm from './LongQueryConfig'

import ListPage, { ListSkeleton as ListPageSkeleton } from './List'

import BUCKET_CONFIGS_QUERY from './gql/BucketConfigs.generated'
import ADD_MUTATION from './gql/BucketsAdd.generated'
import UPDATE_MUTATION from './gql/BucketsUpdate.generated'
import { BucketConfigSelectionFragment as BucketConfig } from './gql/BucketConfigSelection.generated'
import CONTENT_INDEXING_SETTINGS_QUERY from './gql/ContentIndexingSettings.generated'
import TABULATOR_TABLES_QUERY from './gql/TabulatorTables.generated'

const noop = () => {}

const bucketToFormValues = (bucket: BucketConfig) => ({
  title: bucket.title,
  iconUrl: bucket.iconUrl || '',
  description: bucket.description || '',
  relevanceScore: bucket.relevanceScore.toString(),
  overviewUrl: bucket.overviewUrl || '',
  tags: (bucket.tags || []).join(', '),
  linkedData: bucket.linkedData ? JSON.stringify(bucket.linkedData) : '',
  enableDeepIndexing:
    !R.equals(bucket.fileExtensionsToIndex, []) && bucket.indexContentBytes !== 0,
  fileExtensionsToIndex: (bucket.fileExtensionsToIndex || []).join(', '),
  indexContentBytes: bucket.indexContentBytes,
  scannerParallelShardsDepth: bucket.scannerParallelShardsDepth?.toString() || '',
  snsNotificationArn:
    bucket.snsNotificationArn === DO_NOT_SUBSCRIBE_STR
      ? DO_NOT_SUBSCRIBE_SYM
      : bucket.snsNotificationArn,
  skipMetaDataIndexing: bucket.skipMetaDataIndexing ?? false,
  browsable: bucket.browsable ?? false,
})

interface CardAvatarProps {
  className?: string
  src: string
}

function CardAvatar({ className, src }: CardAvatarProps) {
  if (src.startsWith('http')) return <M.Avatar className={className} src={src} />
  return <M.Icon className={className}>{src}</M.Icon>
}

const useCardStyles = M.makeStyles((t) => ({
  avatar: {
    display: 'block',
  },
  header: {
    paddingBottom: t.spacing(1),
  },
  content: {
    paddingTop: 0,
    '& > * + *': {
      marginTop: t.spacing(1),
    },
  },
}))

interface CardProps {
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  icon?: string | null
  onEdit?: () => void
  subTitle?: string
  title: React.ReactNode
}

function Card({
  children,
  className,
  disabled,
  icon,
  onEdit,
  subTitle,
  title,
}: CardProps) {
  const classes = useCardStyles()
  return (
    <M.Card className={className}>
      <M.CardHeader
        action={
          onEdit && (
            <M.IconButton onClick={onEdit} disabled={disabled}>
              <M.Icon>edit</M.Icon>
            </M.IconButton>
          )
        }
        avatar={icon && <CardAvatar className={classes.avatar} src={icon} />}
        className={classes.header}
        subheader={subTitle}
        title={title}
      />
      {children && <M.CardContent className={classes.content}>{children}</M.CardContent>}
    </M.Card>
  )
}

const useFormActionsStyles = M.makeStyles((t) => ({
  actions: {
    animation: `$show 150ms ease-out`,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: t.spacing(2, 1),
    '& > * + *': {
      // Spacing between direct children
      marginLeft: t.spacing(2),
    },
  },
  placeholder: {
    height: t.spacing(8),
  },
  sticky: {
    animation: `$sticking 150ms ease-out`,
    bottom: 0,
    left: '50%',
    position: 'fixed',
    transform: `translateX(-50%)`,
  },
  '@keyframes show': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: '1',
    },
  },
  '@keyframes sticking': {
    '0%': {
      transform: 'translate(-50%, 10%)',
    },
    '100%': {
      transform: 'translate(-50%, 0)',
    },
  },
}))

interface FormActionsProps {
  children: React.ReactNode
  siblingRef: React.RefObject<HTMLElement>
}

// 1. Listen scroll and sibling element resize
// 2. Get the bottom of `<FormActions />` and debounce the value
// 3. If the bottom is below the viewport, make the element `position: "fixed"`
function FormActions({ children, siblingRef }: FormActionsProps) {
  const classes = useFormActionsStyles()

  const [bottom, setBottom] = React.useState(0)
  const ref = React.useRef<HTMLDivElement>(null)
  const handleScroll = React.useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !rect.height) return
    setBottom(rect.bottom)
  }, [])
  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  const { height: siblingHeight } = useResizeObserver({ ref: siblingRef })
  React.useEffect(() => handleScroll(), [handleScroll, siblingHeight])

  const DEBOUNCE_TIMEOUT = 150
  const [debouncedBottom] = useDebounce(bottom, DEBOUNCE_TIMEOUT)
  const sticky = React.useMemo(
    () =>
      debouncedBottom >= (window.innerHeight || document.documentElement.clientHeight),
    [debouncedBottom],
  )

  return (
    <div ref={ref}>
      {sticky ? (
        <>
          <M.Container className={classes.sticky} maxWidth="lg">
            <M.Paper className={classes.actions} elevation={8}>
              {children}
            </M.Paper>
          </M.Container>
          <div className={classes.placeholder} />
        </>
      ) : (
        <div className={classes.actions}>{children}</div>
      )}
    </div>
  )
}

const useSubPageHeaderStyles = M.makeStyles({
  root: {
    display: 'flex',
  },
  back: {
    marginLeft: 'auto',
  },
})

interface SubPageHeaderProps {
  back: () => void
  children?: React.ReactNode
  dirty?: boolean
  disabled?: boolean
  submit: () => void
}

function SubPageHeader({ disabled, back, children, dirty, submit }: SubPageHeaderProps) {
  const classes = useSubPageHeaderStyles()
  const handleConfirm = React.useCallback(
    (confirmed: boolean) => (confirmed ? submit() : back()),
    [back, submit],
  )
  const confirm = Dialog.useConfirm({
    cancelTitle: 'Discard',
    onSubmit: handleConfirm,
    submitTitle: 'Save',
    title: 'You have unsaved changes',
  })
  const handleBack = React.useCallback(
    () => (dirty ? confirm.open() : back()),
    [back, confirm, dirty],
  )
  return (
    <div className={classes.root}>
      {confirm.render(<></>)}
      {children && (
        <M.Typography variant="h6" color="textPrimary">
          {children}
        </M.Typography>
      )}
      <M.Button
        className={classes.back}
        disabled={disabled}
        onClick={handleBack}
        size="small"
        startIcon={<M.Icon>arrow_back</M.Icon>}
      >
        Back to buckets
      </M.Button>
    </div>
  )
}

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

const normalizeExtensions = FP.function.flow(
  Types.decode(Types.fromNullable(IO.string, '')),
  R.replace(/['"]/g, ''),
  R.split(','),
  R.map(R.pipe(R.trim, R.toLower)),
  R.reject((t) => !t),
  R.uniq,
  R.sortBy(R.identity),
  (exts) =>
    exts.length ? (exts as FP.nonEmptyArray.NonEmptyArray<Types.NonEmptyString>) : null,
)

const EXT_RE = /\.[0-9a-z_]+/

const validateExtensions = FP.function.flow(normalizeExtensions, (exts) =>
  exts && !exts.every(R.test(EXT_RE)) ? 'validExtensions' : undefined,
)

const integerInRange = (min: number, max: number) => (v: string | null | undefined) => {
  if (!v) return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) return 'integerInRange'
  return undefined
}

const usePFSCheckboxStyles = M.makeStyles({
  root: {
    marginBottom: -9,
    marginTop: -9,
  },
})

function PFSCheckbox({ input, meta }: Form.CheckboxProps & M.CheckboxProps) {
  const classes = usePFSCheckboxStyles()
  const confirm = React.useCallback((checked) => input?.onChange(checked), [input])
  const dialog = Dialog.useConfirm({
    submitTitle: 'I agree',
    title:
      'You are about to enable JavaScript execution and data access in iframe previews of HTML files',
    onSubmit: confirm,
  })
  const handleCheckbox = React.useCallback(
    (event, checked: boolean) => {
      if (checked) {
        dialog.open()
      } else {
        input?.onChange(checked)
      }
    },
    [dialog, input],
  )
  return (
    <>
      {dialog.render(
        <M.Typography>
          Warning: you must only enable this feature for buckets with trusted contents.
          Failure to heed this warning may result in breach of sensitive data.
        </M.Typography>,
      )}
      <M.FormControlLabel
        control={
          <M.Checkbox
            classes={classes}
            disabled={meta.submitting || meta.submitSucceeded}
            checked={!!input?.checked}
            onChange={handleCheckbox}
          />
        }
        label={
          <>
            Enable permissive HTML rendering
            <Hint>
              This allows execution of any linked JavaScript code and fetching network
              resources relative to the HTML file in the context of an enclosing package
              or a bucket.
              <br />
              Enable only on trusted AWS S3 buckets.
            </Hint>
          </>
        }
      />
    </>
  )
}

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
  fileExtensionsToIndex: (values) =>
    !values.enableDeepIndexing
      ? []
      : FP.function.pipe(values.fileExtensionsToIndex, normalizeExtensions),
  indexContentBytes: (values) =>
    !values.enableDeepIndexing
      ? 0
      : FP.function.pipe(
          values.indexContentBytes,
          Types.decode(Types.fromNullable(IO.string, '')),
          R.trim,
          R.ifElse(R.equals(''), R.always(null), Types.decode(Types.IntFromString)),
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
  browsable: R.pipe(
    R.prop('browsable'),
    Types.decode(Types.fromNullable(IO.boolean, false)),
  ),
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

const useHintStyles = M.makeStyles((t) => ({
  icon: {
    fontSize: '1.125em',
    marginLeft: t.spacing(0.5),
    marginTop: -1,
    opacity: 0.5,
    verticalAlign: -4,
    '&:hover': {
      opacity: 1,
    },
  },
  tooltip: {
    '& ul': {
      marginBottom: 0,
      marginTop: t.spacing(0.5),
      paddingLeft: t.spacing(2),
    },
  },
}))

interface HintProps {
  children: M.TooltipProps['title']
}

function Hint({ children }: HintProps) {
  const classes = useHintStyles()
  const tooltipClasses = React.useMemo(() => ({ tooltip: classes.tooltip }), [classes])
  return (
    <StyledTooltip arrow title={children} classes={tooltipClasses}>
      <M.Icon fontSize="small" className={classes.icon}>
        help
      </M.Icon>
    </StyledTooltip>
  )
}

const useInlineActionsStyles = M.makeStyles((t) => ({
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: t.spacing(2, 0, 0),
    '& > * + *': {
      // Spacing between direct children
      marginLeft: t.spacing(2),
    },
  },
  error: {
    flexGrow: 1,
  },
}))

interface InlineActionsProps {
  form: FF.FormApi
  onCancel: () => void
}

function InlineActions({ form, onCancel }: InlineActionsProps) {
  const classes = useInlineActionsStyles()
  const state = form.getState()
  const handleCancel = React.useCallback(() => {
    form.reset()
    onCancel()
  }, [form, onCancel])
  return (
    <div className={classes.actions}>
      {state.submitFailed && (
        <Form.FormError
          className={classes.error}
          error={state.error || state.submitError}
          errors={{
            unexpected: 'Something went wrong',
            notificationConfigurationError: 'Notification configuration error',
            bucketNotFound: 'Bucket not found',
          }}
          margin="none"
        />
      )}
      {state.submitting && (
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
        disabled={state.pristine || state.submitting}
      >
        Reset
      </M.Button>
      <M.Button onClick={handleCancel} color="primary" disabled={state.submitting}>
        Cancel
      </M.Button>
      <M.Button
        onClick={form.submit}
        color="primary"
        disabled={
          state.pristine ||
          state.submitting ||
          (state.submitFailed && state.hasValidationErrors)
        }
        variant="contained"
      >
        Save
      </M.Button>
    </div>
  )
}

const useInlineFormStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
  title: {
    marginBottom: t.spacing(1),
  },
}))

interface InlineFormProps {
  className?: string
  title?: string
  children: React.ReactNode
}

function InlineForm({ className, children, title }: InlineFormProps) {
  const classes = useInlineFormStyles()
  return (
    <M.Paper className={cx(classes.root, className)}>
      {title && (
        <M.Typography className={classes.title} variant="h6">
          {title}
        </M.Typography>
      )}
      {children}
    </M.Paper>
  )
}

interface PrimaryFormProps {
  bucket?: BucketConfig
  className?: string
  children?: React.ReactNode
}

function PrimaryForm({ bucket, children, className }: PrimaryFormProps) {
  return (
    <InlineForm className={className}>
      {bucket ? (
        <M.TextField
          label="Name"
          value={bucket.name}
          fullWidth
          margin="normal"
          disabled
        />
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
        label="Description (optional)"
        placeholder="Enter description if required"
        parse={R.pipe(R.replace(/^\s+/g, ''), R.take(1024) as (s: string) => string)}
        multiline
        rows={1}
        rowsMax={3}
        fullWidth
        margin="normal"
      />
      {children}
    </InlineForm>
  )
}

interface PrimaryCardProps {
  bucket: BucketConfig
  className: string
  form: FF.FormApi
}

function PrimaryCard({ className, bucket, form }: PrimaryCardProps) {
  const [editing, setEditing] = React.useState(false)
  if (editing) {
    return (
      <PrimaryForm className={className} bucket={bucket}>
        <InlineActions form={form} onCancel={() => setEditing(false)} />
      </PrimaryForm>
    )
  }
  return (
    <Card
      className={className}
      disabled={form.getState().submitting}
      icon={bucket.iconUrl || undefined}
      onEdit={() => setEditing(true)}
      subTitle={`s3://${bucket.name}`}
      title={bucket.title}
    >
      {bucket.description && (
        <M.Typography variant="body2">{bucket.description}</M.Typography>
      )}
    </Card>
  )
}

interface MetadataFormProps {
  children?: React.ReactNode
  className: string
}

function MetadataForm({ children, className }: MetadataFormProps) {
  return (
    <InlineForm className={className} title="Metadata">
      <RF.Field
        component={Form.Field}
        name="relevanceScore"
        label="Relevance score"
        placeholder="Higher numbers appear first, -1 to hide"
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
      {children}
    </InlineForm>
  )
}

const useMetadataCardStyles = M.makeStyles((t) => ({
  tagsList: {
    marginBottoM: t.spacing(-1),
  },
  tag: {
    marginBottom: t.spacing(1),
    verticalAlign: 'baseline',
    '& + &': {
      marginLeft: t.spacing(0.5),
    },
  },
}))

interface MetadataCardProps {
  bucket: BucketConfig
  className: string
  form: FF.FormApi
}

function MetadataCard({ bucket, className, form }: MetadataCardProps) {
  const classes = useMetadataCardStyles()
  const [editing, setEditing] = React.useState(false)
  if (editing) {
    return (
      <MetadataForm className={className}>
        <InlineActions form={form} onCancel={() => setEditing(false)} />
      </MetadataForm>
    )
  }
  return (
    <Card
      className={className}
      disabled={form.getState().submitting}
      icon="toc"
      onEdit={() => setEditing(true)}
      title="Metadata"
    >
      {bucket.description && (
        <M.Typography variant="body2">{bucket.description}</M.Typography>
      )}
      <M.Typography variant="body2">
        Relevance score: {bucket.relevanceScore.toString()}
      </M.Typography>
      {bucket.tags && (
        <M.Typography variant="body2" className={classes.tagsList}>
          Tags:{' '}
          {bucket.tags.map((tag) => (
            <M.Chip
              className={classes.tag}
              label={tag}
              key={tag}
              component="span"
              size="small"
            />
          ))}
        </M.Typography>
      )}
      {bucket.overviewUrl && (
        <M.Typography variant="body2">
          Overview URL:{' '}
          <StyledLink href={bucket.overviewUrl} target="_blank">
            {bucket.overviewUrl}
          </StyledLink>
        </M.Typography>
      )}
      {bucket.linkedData && (
        // @ts-expect-error
        <JsonDisplay
          name="Structured data (JSON-LD)"
          topLevel
          value={bucket.linkedData}
        />
      )}
    </Card>
  )
}

interface IndexingAndNotificationsFormProps {
  bucket?: BucketConfig
  children?: React.ReactNode
  className: string
  reindex?: () => void
  settings: Model.GQLTypes.ContentIndexingSettings
}

function IndexingAndNotificationsForm({
  bucket,
  children,
  className,
  reindex,
  settings,
}: IndexingAndNotificationsFormProps) {
  const classes = useIndexingAndNotificationsFormStyles()
  return (
    <InlineForm className={className} title="Indexing and notifications">
      {!!reindex && (
        <M.Box pb={2.5}>
          <M.Button variant="outlined" fullWidth onClick={reindex}>
            Re-index and repair
          </M.Button>
        </M.Box>
      )}

      <RF.Field
        component={Form.Checkbox}
        type="checkbox"
        name="enableDeepIndexing"
        label={
          <>
            Enable deep indexing
            <Hint>
              Deep indexing adds the <em>contents</em> of an object to your search index,
              while shallow indexing only covers object metadata. Deep indexing may
              require more disk in ElasticSearch. Enable deep indexing when you want your
              users to find files by their contents.
            </Hint>
          </>
        }
      />

      <RF.FormSpy subscription={{ modified: true, values: true }}>
        {({ modified, values }) => {
          // don't need this while adding a bucket
          if (!bucket) return null
          if (
            !modified?.enableDeepIndexing &&
            !modified?.fileExtensionsToIndex &&
            !modified?.indexContentBytes
          )
            return null
          try {
            if (
              R.equals(
                bucket.fileExtensionsToIndex,
                editFormSpec.fileExtensionsToIndex(values),
              ) &&
              R.equals(bucket.indexContentBytes, editFormSpec.indexContentBytes(values))
            )
              return null
          } catch {
            return null
          }

          return (
            <Lab.Alert
              className={classes.warning}
              icon={
                <M.Icon fontSize="inherit" className={classes.warningIcon}>
                  error
                </M.Icon>
              }
              severity="warning"
            >
              Changing these settings affects files that are indexed after the change. If
              you wish to deep index existing files, click{' '}
              <strong>&quot;Re-index and repair&quot;</strong>.
            </Lab.Alert>
          )
        }}
      </RF.FormSpy>

      <RF.FormSpy subscription={{ values: true }}>
        {({ values }) => {
          if (!values.enableDeepIndexing) return null
          return (
            <>
              <RF.Field
                component={Form.Field}
                name="fileExtensionsToIndex"
                label={
                  <>
                    File extensions to deep index (comma-separated)
                    <Hint>
                      Default extensions:
                      <ul>
                        {settings.extensions.map((ext) => (
                          <li key={ext}>{ext}</li>
                        ))}
                      </ul>
                    </Hint>
                  </>
                }
                placeholder='e.g. ".txt, .md", leave blank to use default settings'
                validate={validateExtensions}
                errors={{
                  validExtensions: (
                    <>
                      Enter a comma-separated list of{' '}
                      <abbr title="Must start with the dot and contain only alphanumeric characters thereafter">
                        valid
                      </abbr>{' '}
                      file extensions
                    </>
                  ),
                }}
                fullWidth
                margin="normal"
                multiline
                rows={1}
                rowsMax={3}
              />
              <RF.Field
                component={Form.Field}
                name="indexContentBytes"
                label={
                  <>
                    Content bytes to deep index
                    <Hint>Defaults to {settings.bytesDefault}</Hint>
                  </>
                }
                placeholder='e.g. "1024", leave blank to use default settings'
                parse={R.replace(/[^0-9]/g, '')}
                validate={integerInRange(settings.bytesMin, settings.bytesMax)}
                errors={{
                  integerInRange: (
                    <>
                      Enter an integer from {settings.bytesMin} to {settings.bytesMax}
                    </>
                  ),
                }}
                fullWidth
                margin="normal"
              />
            </>
          )
        }}
      </RF.FormSpy>
      <RF.Field
        component={Form.Field}
        name="scannerParallelShardsDepth"
        label="Scanner parallel shards depth"
        placeholder="Leave blank to use default settings"
        validate={validators.integer as FF.FieldValidator<any>}
        errors={{
          integer: 'Enter a valid integer',
        }}
        parse={R.pipe(R.replace(/[^0-9]/g, ''), R.take(16) as (s: string) => string)}
        fullWidth
        margin="normal"
      />
      <RF.Field component={SnsField} name="snsNotificationArn" validate={validateSns} />
      <M.Box mt={2}>
        <RF.Field
          component={Form.Checkbox}
          type="checkbox"
          name="skipMetaDataIndexing"
          label="Skip metadata indexing"
        />
      </M.Box>
      {!bucket && (
        <M.Box mt={1}>
          <RF.Field
            component={Form.Checkbox}
            type="checkbox"
            name="delayScan"
            label="Delay scan"
          />
        </M.Box>
      )}
      {children}
    </InlineForm>
  )
}

const useIndexingAndNotificationsFormStyles = M.makeStyles((t) => ({
  warning: {
    background: t.palette.warning.main,
    marginBottom: t.spacing(1),
    marginTop: t.spacing(2),
  },
  warningIcon: {
    color: t.palette.warning.dark,
  },
}))

interface IndexingAndNotificationsCardProps {
  bucket: BucketConfig
  className: string
  form: FF.FormApi
  reindex?: () => void
}

function IndexingAndNotificationsCard({
  bucket,
  className,
  form,
  reindex,
}: IndexingAndNotificationsCardProps) {
  const [editing, setEditing] = React.useState(false)

  const data = GQL.useQueryS(CONTENT_INDEXING_SETTINGS_QUERY)
  const settings = data.config.contentIndexingSettings

  if (editing) {
    return (
      <IndexingAndNotificationsForm
        bucket={bucket}
        className={className}
        reindex={reindex}
        settings={settings}
      >
        <InlineActions form={form} onCancel={() => setEditing(false)} />
      </IndexingAndNotificationsForm>
    )
  }

  const { enableDeepIndexing, snsNotificationArn } = bucketToFormValues(bucket)
  return (
    <Card
      className={className}
      disabled={form.getState().submitting}
      onEdit={() => setEditing(true)}
      icon="find_in_page"
      title="Indexing and notifications"
    >
      {!!reindex && (
        <M.Button
          variant="outlined"
          onClick={reindex}
          size="small"
          disabled={form.getState().submitting}
        >
          Re-index and repair
        </M.Button>
      )}
      {enableDeepIndexing ? (
        <>
          {bucket.fileExtensionsToIndex ? (
            <M.Typography variant="body2">
              File extensions to deep index:
              {bucket.fileExtensionsToIndex.join(', ')}
            </M.Typography>
          ) : (
            <M.Typography variant="body2">
              Default file extensions to deep index:
              {settings.extensions.join(', ')}
            </M.Typography>
          )}
          {bucket.indexContentBytes ? (
            <M.Typography variant="body2">
              Content bytes to deep index is {formatQuantity(bucket.indexContentBytes)}{' '}
              bytes
            </M.Typography>
          ) : (
            <M.Typography variant="body2">
              Default content bytes to deep index is{' '}
              {formatQuantity(settings.bytesDefault)} bytes
            </M.Typography>
          )}
        </>
      ) : (
        <M.Typography variant="body2">Deep indexing is disabled</M.Typography>
      )}
      {bucket.scannerParallelShardsDepth && (
        <M.Typography variant="body2">
          Scanner parallel shards depth: {bucket.scannerParallelShardsDepth}
        </M.Typography>
      )}
      {bucket.skipMetaDataIndexing && (
        <M.Typography variant="body2">Metadata indexing is disabled</M.Typography>
      )}
      {typeof snsNotificationArn === 'string' && (
        <M.Typography variant="body2">
          SNS Topic ARN:{' '}
          <StyledLink
            href={`https://console.aws.amazon.com/sns/v3/home?#/topic/${bucket.snsNotificationArn}`}
            target="_blank"
          >
            {bucket.snsNotificationArn}
          </StyledLink>
        </M.Typography>
      )}
    </Card>
  )
}

interface PreviewFormProps {
  children?: React.ReactNode
  className: string
}

function PreviewForm({ children, className }: PreviewFormProps) {
  return (
    <InlineForm className={className}>
      <RF.Field component={PFSCheckbox} name="browsable" type="checkbox" />
      {children}
    </InlineForm>
  )
}

interface PreviewCardProps {
  className: string
  bucket: BucketConfig
  form: FF.FormApi
}

function PreviewCard({ bucket, className, form }: PreviewCardProps) {
  const [editing, setEditing] = React.useState(false)
  if (editing) {
    return (
      <PreviewForm className={className}>
        <InlineActions form={form} onCancel={() => setEditing(false)} />
      </PreviewForm>
    )
  }
  return (
    <Card
      className={className}
      disabled={form.getState().submitting}
      onEdit={() => setEditing(true)}
      icon="code"
      title={`Permissive HTML rendering is ${bucket.browsable ? 'enabled' : 'disabled'}`}
    />
  )
}

interface LongQueryConfigSingleProps extends Model.GQLTypes.TabulatorTable {}

function LongQueryConfigSingle({ name, config }: LongQueryConfigSingleProps) {
  const json = React.useMemo(() => yaml.parse(config), [config])
  // @ts-expect-error
  return <JsonDisplay name={name} topLevel value={json} />
}

interface LongQueryConfigCardProps {
  className: string
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
  disabled: boolean
}

function LongQueryConfigCard({
  className,
  disabled,
  tabulatorTables,
}: LongQueryConfigCardProps) {
  const [editing, setEditing] = React.useState(false)
  const onSubmit = React.useCallback(
    () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(undefined)
        }, 10000)
      }),
    [],
  )
  if (editing) {
    return (
      <InlineForm className={className}>
        <RF.Form
          onSubmit={onSubmit}
          initialValues={{ tabulatorTables }}
          mutators={{ ...arrayMutators }}
        >
          {({ form, handleSubmit }) => (
            <form onSubmit={handleSubmit}>
              <LongQueryConfigForm>
                <InlineActions form={form} onCancel={() => setEditing(false)} />
              </LongQueryConfigForm>
            </form>
          )}
        </RF.Form>
      </InlineForm>
    )
  }
  return (
    <Card
      className={className}
      disabled={disabled}
      onEdit={() => setEditing(true)}
      icon="query_builder"
      title="Longitudinal Query Configuration"
    >
      {tabulatorTables.map((table, i) => (
        <LongQueryConfigSingle {...table} key={`${table.name}_${i}`} />
      ))}
    </Card>
  )
}

const useStyles = M.makeStyles((t) => ({
  card: {
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
  error: {
    flexGrow: 1,
  },
  fields: {
    marginTop: t.spacing(2),
  },
}))

interface AddPageSkeletonProps {
  back: () => void
}

function AddPageSkeleton({ back }: AddPageSkeletonProps) {
  const classes = useStyles()
  const formRef = React.useRef<HTMLDivElement>(null)
  return (
    <>
      <SubPageHeader back={back} submit={noop}>
        Add a bucket
      </SubPageHeader>
      <div className={classes.fields} ref={formRef}>
        <InlineForm className={classes.card}>
          <Skeleton height={54} />
          <Skeleton height={54} mt={4} />
          <Skeleton height={54} mt={4} />
        </InlineForm>
        <InlineForm className={classes.card}>
          <Skeleton height={54} />
          <Skeleton height={54} mt={4} />
          <Skeleton height={54} mt={4} />
        </InlineForm>
        <InlineForm className={classes.card}>
          <Skeleton height={54} />
          <Skeleton height={54} mt={4} />
          <Skeleton height={54} mt={4} />
        </InlineForm>
        <InlineForm className={classes.card}>
          <Skeleton height={54} />
        </InlineForm>
        <FormActions siblingRef={formRef}>
          <Buttons.Skeleton />
          <Buttons.Skeleton />
        </FormActions>
      </div>
    </>
  )
}

function parseResponseError(
  r:
    | Exclude<Model.GQLTypes.BucketAddResult, Model.GQLTypes.BucketAddSuccess>
    | Exclude<Model.GQLTypes.BucketUpdateResult, Model.GQLTypes.BucketUpdateSuccess>,
): FF.SubmissionErrors | undefined {
  switch (r.__typename) {
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
    case 'SubscriptionInvalid':
      return { [FF.FORM_ERROR]: 'subscriptionInvalid' }
    case 'BucketIndexContentBytesInvalid':
      // shouldnt happen since we valide input
      return { indexContentBytes: 'integerInRange' }
    case 'BucketFileExtensionsToIndexInvalid':
      // shouldnt happen since we valide input
      return { fileExtensionsToIndex: 'validExtensions' }
    case 'BucketNotFound':
      return { [FF.FORM_ERROR]: 'bucketNotFound' }
    default:
      return assertNever(r)
  }
}

interface AddProps {
  back: (reason?: string) => void
  settings: Model.GQLTypes.ContentIndexingSettings
  submit: (
    input: Model.GQLTypes.BucketAddInput,
  ) => Promise<
    | Exclude<Model.GQLTypes.BucketAddResult, Model.GQLTypes.BucketAddSuccess>
    | Error
    | undefined
  >
}

function Add({ back, settings, submit }: AddProps) {
  const classes = useStyles()
  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const input = R.applySpec(addFormSpec)(values)
        const error = await submit(input)
        if (!error) return
        if (error instanceof Error) throw error
        return parseResponseError(error)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error adding bucket')
        // eslint-disable-next-line no-console
        console.error(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [submit],
  )
  const scrollingRef = React.useRef<HTMLDivElement>(null)
  return (
    <RF.Form onSubmit={onSubmit} initialValues={{ enableDeepIndexing: true }}>
      {({
        dirty,
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
      }) => (
        <>
          <SubPageHeader
            back={back}
            dirty={dirty}
            disabled={submitting}
            submit={handleSubmit}
          >
            Add a bucket
          </SubPageHeader>
          <div className={classes.fields} ref={scrollingRef}>
            <form className={classes.card} onSubmit={handleSubmit}>
              <PrimaryForm className={classes.card} />
              <MetadataForm className={classes.card} />
              <IndexingAndNotificationsForm
                className={classes.card}
                settings={settings}
              />
              <PreviewForm className={classes.card} />
              <input type="submit" style={{ display: 'none' }} />
            </form>
            <LongQueryConfigForm className={classes.card} />
          </div>
          <FormActions siblingRef={scrollingRef}>
            {submitFailed && (
              <Form.FormError
                className={classes.error}
                error={error || submitError}
                errors={{
                  unexpected: 'Something went wrong',
                  notificationConfigurationError: 'Notification configuration error',
                  insufficientPermissions: 'Insufficient permissions',
                  subscriptionInvalid: 'Subscription invalid',
                }}
                margin="none"
              />
            )}
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
              onClick={() => back('cancel')}
              color="primary"
              disabled={submitting}
            >
              Cancel
            </M.Button>
            <M.Button
              onClick={handleSubmit}
              color="primary"
              disabled={submitting || (submitFailed && hasValidationErrors)}
              variant="contained"
            >
              Add
            </M.Button>
          </FormActions>
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
            // @ts-expect-error, FF.FieldInputProps misses second argument for onChange
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

interface BucketFieldSkeletonProps {
  className: string
  width: number
}

function BucketFieldSkeleton({ className, width }: BucketFieldSkeletonProps) {
  return <Card className={className} title={<Skeleton height={32} width={width} />} />
}

interface CardsPlaceholderProps {
  className: string
}

function CardsPlaceholder({ className }: CardsPlaceholderProps) {
  const classes = useStyles()
  return (
    <div className={className}>
      <BucketFieldSkeleton className={classes.card} width={300} />
      <BucketFieldSkeleton className={classes.card} width={100} />
      <BucketFieldSkeleton className={classes.card} width={240} />
      <BucketFieldSkeleton className={classes.card} width={180} />
    </div>
  )
}

interface EditPageSkeletonProps {
  back: () => void
}

function EditPageSkeleton({ back }: EditPageSkeletonProps) {
  const classes = useStyles()
  return (
    <>
      <SubPageHeader back={back} submit={noop} />
      <CardsPlaceholder className={classes.fields} />
    </>
  )
}

interface EditProps {
  bucket: BucketConfig
  back: (reason?: string) => void
  submit: (
    input: Model.GQLTypes.BucketUpdateInput,
  ) => Promise<
    | Exclude<Model.GQLTypes.BucketUpdateResult, Model.GQLTypes.BucketUpdateSuccess>
    | Error
    | undefined
  >
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
}

function Edit({ bucket, back, submit, tabulatorTables }: EditProps) {
  const [reindexOpen, setReindexOpen] = React.useState(false)
  const openReindex = React.useCallback(() => setReindexOpen(true), [])
  const closeReindex = React.useCallback(() => setReindexOpen(false), [])

  const classes = useStyles()

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const input = R.applySpec(editFormSpec)(values)
        const error = await submit(input)
        if (!error) return
        if (error instanceof Error) throw error
        return parseResponseError(error)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating bucket')
        // eslint-disable-next-line no-console
        console.error(e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [submit],
  )

  // const [editing, setEditing] = React.useState<'primary'|'metadata'|'indexing'|'preview'| 'longquery'|null>(null)

  const initialValues = bucketToFormValues(bucket)

  const scrollingRef = React.useRef<HTMLDivElement>(null)

  return (
    <RF.Form onSubmit={onSubmit} initialValues={initialValues}>
      {({ handleSubmit, submitting, pristine, form }) => (
        <>
          <Reindex bucket={bucket.name} open={reindexOpen} close={closeReindex} />
          <SubPageHeader
            back={back}
            dirty={!pristine}
            disabled={submitting}
            submit={handleSubmit}
          />
          <React.Suspense fallback={<CardsPlaceholder className={classes.fields} />}>
            <div className={classes.fields} ref={scrollingRef}>
              <form className={classes.card} onSubmit={handleSubmit}>
                <PrimaryCard bucket={bucket} className={classes.card} form={form} />
                <MetadataCard bucket={bucket} className={classes.card} form={form} />
                <IndexingAndNotificationsCard
                  bucket={bucket}
                  className={classes.card}
                  form={form}
                  reindex={openReindex}
                />
                <PreviewCard bucket={bucket} className={classes.card} form={form} />
                <input type="submit" style={{ display: 'none' }} />
              </form>
              <LongQueryConfigCard
                className={classes.card}
                tabulatorTables={tabulatorTables}
                disabled={submitting}
              />
            </div>
          </React.Suspense>
        </>
      )}
    </RF.Form>
  )
}

interface EditRouteParams {
  bucketName: string
}

interface EditPageProps {
  back: () => void
}

function EditPage({ back }: EditPageProps) {
  const { bucketName } = RRDom.useParams<EditRouteParams>()
  const { urls } = NamedRoutes.use()
  const update = GQL.useMutation(UPDATE_MUTATION)
  const { bucketConfigs: rows } = GQL.useQueryS(BUCKET_CONFIGS_QUERY)
  const bucket = React.useMemo(
    () => (bucketName ? rows.find(({ name }) => name === bucketName) : null),
    [bucketName, rows],
  )
  const tabulatorTables =
    GQL.useQueryS(TABULATOR_TABLES_QUERY).bucketConfig?.tabulatorTables || []
  // const tabulatorTables = [
  //   {
  //     __typename: 'TabulatorTable' as const,
  //     name: 'one',
  //     config: `lorem: ipsum`,
  //   },
  //   {
  //     __typename: 'TabulatorTable' as const,
  //     name: 'two',
  //     config: `foo: bar`,
  //   },
  // ]

  const submit = React.useCallback(
    async (input: Model.GQLTypes.BucketUpdateInput) => {
      if (!bucket) return new Error('Submit form without bucket')
      try {
        const { bucketUpdate: r } = await update({ name: bucket.name, input })
        if (r.__typename !== 'BucketUpdateSuccess') {
          // TS infered shape but not the actual type
          return r as Exclude<
            Model.GQLTypes.BucketUpdateResult,
            Model.GQLTypes.BucketUpdateSuccess
          >
        }
        back()
      } catch (e) {
        return e instanceof Error ? e : new Error('Error updating bucket')
      }
    },
    [back, bucket, update],
  )
  if (!bucket) return <RRDom.Redirect to={urls.adminBuckets()} />
  return (
    <Edit bucket={bucket} back={back} submit={submit} tabulatorTables={tabulatorTables} />
  )
}

interface AddPageProps {
  back: () => void
}

function AddPage({ back }: AddPageProps) {
  const data = GQL.useQueryS(CONTENT_INDEXING_SETTINGS_QUERY)
  const settings = data.config.contentIndexingSettings
  const add = GQL.useMutation(ADD_MUTATION)
  const { push } = Notifications.use()
  const { track } = useTracker()
  const submit = React.useCallback(
    async (input: Model.GQLTypes.BucketAddInput) => {
      try {
        const { bucketAdd: r } = await add({ input })
        if (r.__typename !== 'BucketAddSuccess')
          // TS infered shape but not the actual type
          return r as Exclude<
            Model.GQLTypes.BucketAddResult,
            Model.GQLTypes.BucketAddSuccess
          >
        push(`Bucket "${r.bucketConfig.name}" added`)
        track('WEB', {
          type: 'admin',
          action: 'bucket add',
          bucket: r.bucketConfig.name,
        })
        back()
      } catch (e) {
        return e instanceof Error ? e : new Error('Error adding bucket')
      }
    },
    [add, back, push, track],
  )
  return <Add settings={settings} back={back} submit={submit} />
}

export default function Buckets() {
  const history = RRDom.useHistory()
  const { paths, urls } = NamedRoutes.use()
  const back = React.useCallback(() => history.push(urls.adminBuckets()), [history, urls])
  return (
    <M.Box mt={2} mb={2}>
      <MetaTitle>{['Buckets', 'Admin']}</MetaTitle>
      <RRDom.Switch>
        <RRDom.Route path={paths.adminBucketAdd} exact strict>
          <React.Suspense fallback={<AddPageSkeleton back={back} />}>
            <AddPage back={back} />
          </React.Suspense>
        </RRDom.Route>
        <RRDom.Route path={paths.adminBucketEdit} exact strict>
          <React.Suspense fallback={<EditPageSkeleton back={back} />}>
            <EditPage back={back} />
          </React.Suspense>
        </RRDom.Route>
        <RRDom.Route>
          <React.Suspense fallback={<ListPageSkeleton />}>
            <ListPage />
          </React.Suspense>
        </RRDom.Route>
      </RRDom.Switch>
    </M.Box>
  )
}
