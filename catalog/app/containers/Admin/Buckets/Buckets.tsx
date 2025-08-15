import cx from 'classnames'
import * as FF from 'final-form'
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
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as quiltConfigs from 'constants/quiltConfigs'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import type FormSpec from 'utils/FormSpec'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import parseSearch from 'utils/parseSearch'
import { useTracker } from 'utils/tracking'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'

import * as Form from '../Form'
import * as OnDirty from './OnDirty'
import TabulatorForm from './Tabulator'

import ListPage, { ListSkeleton as ListPageSkeleton } from './List'

import BUCKET_CONFIGS_QUERY from './gql/BucketConfigs.generated'
import ADD_MUTATION from './gql/BucketsAdd.generated'
import UPDATE_MUTATION from './gql/BucketsUpdate.generated'
import { BucketConfigSelectionFragment as BucketConfig } from './gql/BucketConfigSelection.generated'
import CONTENT_INDEXING_SETTINGS_QUERY from './gql/ContentIndexingSettings.generated'
import TABULATOR_TABLES_QUERY from './gql/TabulatorTables.generated'

const bucketToPrimaryValues = (bucket: BucketConfig) => ({
  title: bucket.title,
  iconUrl: bucket.iconUrl || '',
  description: bucket.description || '',
})

const bucketToMetadataValues = (bucket: BucketConfig) => ({
  relevanceScore: bucket.relevanceScore.toString(),
  overviewUrl: bucket.overviewUrl || '',
  tags: (bucket.tags || []).join(', '),
  linkedData: bucket.linkedData ? JSON.stringify(bucket.linkedData) : '',
})

const bucketToIndexingAndNotificationsValues = (bucket: BucketConfig) => ({
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
})

const bucketToPreviewValues = (bucket: BucketConfig) => ({
  browsable: bucket.browsable ?? false,
})

const bucketToFormValues = (bucket: BucketConfig) => ({
  ...bucketToPrimaryValues(bucket),
  ...bucketToMetadataValues(bucket),
  ...bucketToIndexingAndNotificationsValues(bucket),
  ...bucketToPreviewValues(bucket),
})

const useStickyActionsStyles = M.makeStyles((t) => ({
  actions: {
    animation: `$show 150ms ease-out`,
    padding: t.spacing(3, 0, 0),
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'flex-end',
    '& > * + *': {
      // Spacing between direct children
      marginLeft: t.spacing(2),
    },
  },
  sticky: {
    animation: `$sticking 150ms ease-out`,
    bottom: 0,
    left: '50%',
    position: 'fixed',
    transform: `translateX(-50%)`,
    '& $actions': {
      padding: t.spacing(2),
    },
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

interface StickyActionsProps {
  children: React.ReactNode
  parentRef: React.RefObject<HTMLElement>
}

function StickyActions({ children, parentRef }: StickyActionsProps) {
  const classes = useStickyActionsStyles()

  const [size, setSize] = React.useState<DOMRect | null>(null)
  const [parentSize, setParentSize] = React.useState<DOMRect | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const handleScroll = React.useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !rect.height) return
    setSize(rect)
    const parent = parentRef.current?.getBoundingClientRect()
    if (!parent || !parent.height) return
    setParentSize(parent)
  }, [parentRef])
  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  const { height: parentHeight } = useResizeObserver({ ref: parentRef })
  React.useEffect(() => handleScroll(), [handleScroll, parentHeight])

  const DEBOUNCE_TIMEOUT = 50
  const [debouncedSize] = useDebounce(size, DEBOUNCE_TIMEOUT)
  const [debouncedParentSize] = useDebounce(parentSize, DEBOUNCE_TIMEOUT)
  const sticky = React.useMemo(() => {
    const winHeight = window.innerHeight || document.documentElement.clientHeight

    const containerBottom = debouncedSize?.bottom || 0
    const containerHeight = debouncedSize?.height || 0
    const parentTop = debouncedParentSize?.top || 0

    return (
      // Container's bottom (relative to viewport) is below the viewport's bottom
      containerBottom >= winHeight + containerHeight &&
      // Parent's top is inside the viewport
      parentTop >= 0 &&
      parentTop <= winHeight - containerHeight
    )
  }, [debouncedSize, debouncedParentSize])

  return (
    <div ref={ref}>
      {sticky ? (
        <>
          <M.Container className={classes.sticky} maxWidth="lg">
            <M.Paper className={classes.actions} elevation={8}>
              {children}
            </M.Paper>
          </M.Container>
          <div style={{ height: debouncedSize?.height }}>{/* height placeholder */}</div>
        </>
      ) : (
        <div className={classes.actions}>{children}</div>
      )}
    </div>
  )
}

const useSubPageHeaderStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  back: {
    marginRight: t.spacing(2),
  },
}))

interface SubPageHeaderProps {
  back: () => void
  children: React.ReactNode
  disabled?: boolean
}

function SubPageHeader({ disabled, back, children }: SubPageHeaderProps) {
  const classes = useSubPageHeaderStyles()
  return (
    <div className={classes.root}>
      <M.IconButton
        className={classes.back}
        disabled={disabled}
        onClick={back}
        size="small"
      >
        <M.Icon>arrow_back</M.Icon>
      </M.IconButton>
      <M.Typography variant="h5" color="textPrimary">
        {children}
      </M.Typography>
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

interface PFSCheckboxProps extends Form.CheckboxProps, M.CheckboxProps {
  onToggle?: () => void
}

function PFSCheckbox({ input, meta, onToggle, ...props }: PFSCheckboxProps) {
  const classes = usePFSCheckboxStyles()
  const confirm = React.useCallback(
    (checked) => {
      input?.onChange(checked)
      if (onToggle) {
        onToggle()
      }
    },
    [input, onToggle],
  )
  const dialog = Dialog.useConfirm({
    submitTitle: 'I agree',
    title:
      'You are about to enable JavaScript execution and data access in iframe previews of HTML files',
    onSubmit: confirm,
  })
  const handleCheckbox = React.useCallback(
    (_event, checked: boolean) => {
      if (checked) {
        dialog.open()
      } else {
        confirm(checked)
      }
    },
    [dialog, confirm],
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
          onToggle ? (
            <M.Switch
              disabled={meta.submitting || meta.submitSucceeded}
              checked={!!input?.checked}
              onChange={handleCheckbox}
              {...props}
            />
          ) : (
            <M.Checkbox
              classes={classes}
              disabled={meta.submitting || meta.submitSucceeded}
              checked={!!input?.checked}
              onChange={handleCheckbox}
              {...props}
            />
          )
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
      {meta.submitFailed && !!(meta.error || meta.submitError) && (
        <M.FormHelperText error>{meta.error || meta.submitError}</M.FormHelperText>
      )}
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
    <M.Tooltip arrow title={children} classes={tooltipClasses}>
      <M.Icon fontSize="small" className={classes.icon}>
        help
      </M.Icon>
    </M.Tooltip>
  )
}

const useCardActionsStyles = M.makeStyles((t) => ({
  actions: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    marginLeft: t.spacing(1),
  },
  helper: {
    flexGrow: 1,
  },
}))

interface CardActionsProps<T> {
  action?: React.ReactNode
  disabled: boolean
  form: FF.FormApi<T>
}

function CardActions<T>({ action, disabled, form }: CardActionsProps<T>) {
  const { onChange } = OnDirty.use()
  const classes = useCardActionsStyles()
  const state = form.getState()
  const { reset, submit } = form
  const error = React.useMemo(() => {
    if (!state.submitFailed) return
    if (state.error || state.submitError) return state.error || state.submitError
    // This could happen only if we forgot to handle an error in fields
    return `Unhandled error: ${JSON.stringify(state.submitErrors)}`
  }, [state])
  return (
    <>
      <OnDirty.Spy onChange={onChange} />
      {action}
      <div className={classes.helper}>
        {error && (
          <Form.FormError
            error={error}
            errors={{
              unexpected: 'Something went wrong',
              notificationConfigurationError: 'Notification configuration error',
              bucketNotFound: 'Bucket not found',
            }}
            margin="none"
          />
        )}
      </div>
      {state.submitting && (
        <M.Fade in style={{ transitionDelay: '1000ms' }}>
          <M.CircularProgress size={24} />
        </M.Fade>
      )}
      <M.Button
        className={classes.button}
        onClick={() => reset()}
        color="primary"
        disabled={state.pristine || state.submitting || disabled}
      >
        Reset
      </M.Button>
      <M.Button
        className={classes.button}
        onClick={() => submit()}
        color="primary"
        disabled={
          state.pristine ||
          state.submitting ||
          (state.submitFailed && state.hasValidationErrors) ||
          disabled
        }
        variant="contained"
      >
        Save
      </M.Button>
    </>
  )
}

interface PrimaryFormProps {
  bucket?: BucketConfig
}

function PrimaryForm({ bucket }: PrimaryFormProps) {
  return (
    <>
      {!bucket && (
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
        margin={bucket ? 'none' : 'normal'}
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
      <input type="submit" style={{ display: 'none' }} />
    </>
  )
}

const useCardStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 3),
    position: 'relative',
  },
  disabled: {
    position: 'relative',
    opacity: 0.3,
    '&::after': {
      content: '""',
      bottom: 0,
      cursor: 'not-allowed',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
    },
  },
  icon: {},
  error: {
    outline: `1px solid ${t.palette.error.main}`,
  },
  title: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(2),
  },
  content: {
    // XXX: Fixed in some future MUI versions https://github.com/mui/material-ui/issues/10464
    '& textarea[rows]': {
      minHeight: '19px',
    },
  },
}))

interface CardProps {
  children: React.ReactNode
  className: string
  disabled?: boolean
  error?: boolean
  title?: React.ReactNode
}

const Card = React.forwardRef<HTMLElement, CardProps>(function Card(
  { children, className, disabled, error, title },
  ref,
) {
  const classes = useCardStyles()
  return (
    <M.Paper
      className={cx(
        classes.root,
        {
          [classes.disabled]: disabled,
          [classes.error]: error,
        },
        className,
      )}
      ref={ref}
    >
      {title && (
        <div className={classes.title}>
          <M.Typography variant="h6">{title}</M.Typography>
        </div>
      )}
      <div className={classes.content}>{children}</div>
    </M.Paper>
  )
})

type PrimaryFormValues = ReturnType<typeof bucketToPrimaryValues>

interface PrimaryCardProps {
  bucket: BucketConfig
  className: string
  disabled: boolean
  onSubmit: FF.Config<PrimaryFormValues>['onSubmit']
}

function PrimaryCard({ bucket, className, disabled, onSubmit }: PrimaryCardProps) {
  const initialValues = bucketToPrimaryValues(bucket)
  const ref = React.useRef<HTMLElement>(null)
  const { urls } = NamedRoutes.use()
  const configPath = quiltConfigs.bucketPreferences[0]
  const configHref = urls.bucketFile(bucket.name, configPath, {
    edit: true,
  })
  return (
    <RF.Form<PrimaryFormValues> onSubmit={onSubmit} initialValues={initialValues}>
      {({ handleSubmit, form, submitFailed }) => (
        <Card
          className={className}
          disabled={disabled}
          error={submitFailed}
          ref={ref}
          title="Display settings"
        >
          <form onSubmit={handleSubmit}>
            <PrimaryForm bucket={bucket} />
          </form>
          <StickyActions parentRef={ref}>
            <CardActions<PrimaryFormValues>
              action={<StyledLink to={configHref}>Configure Bucket UI</StyledLink>}
              disabled={disabled}
              form={form}
            />
          </StickyActions>
        </Card>
      )}
    </RF.Form>
  )
}

function MetadataForm() {
  return (
    <>
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
    </>
  )
}

type MetadataFormValues = ReturnType<typeof bucketToMetadataValues>

interface MetadataCardProps {
  bucket: BucketConfig
  className: string
  disabled: boolean
  onSubmit: FF.Config<MetadataFormValues>['onSubmit']
}

function MetadataCard({ bucket, className, disabled, onSubmit }: MetadataCardProps) {
  const initialValues = bucketToMetadataValues(bucket)
  const ref = React.useRef<HTMLElement>(null)
  return (
    <RF.Form<MetadataFormValues> onSubmit={onSubmit} initialValues={initialValues}>
      {({ handleSubmit, form, submitFailed }) => (
        <Card
          className={className}
          disabled={disabled}
          error={submitFailed}
          ref={ref}
          title="Metadata"
        >
          <form onSubmit={handleSubmit}>
            <MetadataForm />
          </form>
          <StickyActions parentRef={ref}>
            <CardActions<MetadataFormValues> disabled={disabled} form={form} />
          </StickyActions>
        </Card>
      )}
    </RF.Form>
  )
}

interface IndexingAndNotificationsFormProps {
  bucket?: BucketConfig
  settings: Model.GQLTypes.ContentIndexingSettings
}

function IndexingAndNotificationsForm({
  bucket,
  settings,
}: IndexingAndNotificationsFormProps) {
  const classes = useIndexingAndNotificationsFormStyles()
  return (
    <>
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
    </>
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

type IndexingAndNotificationsFormValues = ReturnType<
  typeof bucketToIndexingAndNotificationsValues
>

interface IndexingAndNotificationsCardProps {
  bucket: BucketConfig
  className: string
  disabled: boolean
  onSubmit: FF.Config<IndexingAndNotificationsFormValues>['onSubmit']
  onReindex: () => void
}

function IndexingAndNotificationsCard({
  bucket,
  className,
  disabled,
  onSubmit,
  onReindex,
}: IndexingAndNotificationsCardProps) {
  const data = GQL.useQueryS(CONTENT_INDEXING_SETTINGS_QUERY)
  const settings = data.config.contentIndexingSettings

  const initialValues = bucketToIndexingAndNotificationsValues(bucket)
  const ref = React.useRef<HTMLFormElement>(null)

  return (
    <RF.Form<IndexingAndNotificationsFormValues>
      onSubmit={onSubmit}
      initialValues={initialValues}
    >
      {({ handleSubmit, form, submitFailed }) => (
        <Card
          className={className}
          disabled={disabled}
          error={submitFailed}
          ref={ref}
          title="Indexing and notifications"
        >
          <form onSubmit={handleSubmit}>
            <IndexingAndNotificationsForm bucket={bucket} settings={settings} />
          </form>
          <StickyActions parentRef={ref}>
            <CardActions<IndexingAndNotificationsFormValues>
              action={
                <M.Button
                  disabled={disabled}
                  onClick={onReindex}
                  variant="outlined"
                  size="small"
                >
                  Re-index and repair
                </M.Button>
              }
              disabled={disabled}
              form={form}
            />
          </StickyActions>
        </Card>
      )}
    </RF.Form>
  )
}

function PreviewForm() {
  return <RF.Field component={PFSCheckbox} name="browsable" type="checkbox" />
}

type PreviewFormValues = ReturnType<typeof bucketToPreviewValues>

interface PreviewCardProps {
  bucket: BucketConfig
  className: string
  disabled: boolean
  onSubmit: FF.Config<PreviewFormValues>['onSubmit']
}

function PreviewCard({ bucket, className, disabled, onSubmit }: PreviewCardProps) {
  const initialValues = bucketToPreviewValues(bucket)
  return (
    <RF.Form<PreviewFormValues> onSubmit={onSubmit} initialValues={initialValues}>
      {({ handleSubmit, submitting, form, error, submitError, submitFailed }) => (
        <Card className={className} disabled={disabled} error={submitFailed}>
          <form onSubmit={handleSubmit}>
            <RF.Field
              component={PFSCheckbox}
              disabled={submitting || disabled}
              name="browsable"
              type="checkbox"
              onToggle={() => form.submit()}
            />
            <Form.FormError
              error={error || submitError}
              errors={{
                unexpected: 'Something went wrong',
              }}
              margin="none"
            />
          </form>
        </Card>
      )}
    </RF.Form>
  )
}

interface TabulatorCardProps {
  bucket: string
  className: string
  disabled: boolean
  /** Have to be memoized */
  onDirty: (dirty: boolean) => void
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
}

function TabulatorCard({
  bucket,
  className,
  disabled,
  onDirty,
  tabulatorTables,
}: TabulatorCardProps) {
  const { dirty } = OnDirty.use()
  React.useEffect(() => onDirty(dirty), [dirty, onDirty])
  return (
    <Card
      className={className}
      disabled={disabled}
      title="Tabulator (Longitudinal Querying)"
    >
      <TabulatorForm bucket={bucket} tables={tabulatorTables} />
    </Card>
  )
}

const useStyles = M.makeStyles((t) => ({
  card: {
    marginTop: t.spacing(2),
    '&:first-child': {
      marginTop: 0,
    },
  },
  formTitle: {
    ...t.typography.subtitle2,
    marginBottom: t.spacing(2),
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
    <div ref={formRef}>
      <SubPageHeader back={back}>Add a bucket</SubPageHeader>
      <CardsPlaceholder className={classes.fields} />
      <StickyActions parentRef={formRef}>
        <Buttons.Skeleton />
        <Buttons.Skeleton />
      </StickyActions>
    </div>
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
    async (values, form) => {
      try {
        const input = R.applySpec(addFormSpec)(values)
        const error = await submit(input)
        if (!error) {
          form.reset(values)
          back()
          return
        }
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
    [back, submit],
  )
  const scrollingRef = React.useRef<HTMLFormElement>(null)
  const guardNavigation = React.useCallback(
    () => 'You have unsaved changes. Discard changes and leave the page?',
    [],
  )
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
          <RRDom.Prompt when={!!dirty} message={guardNavigation} />
          <SubPageHeader back={back} disabled={submitting}>
            Add a bucket
          </SubPageHeader>
          <form className={classes.fields} onSubmit={handleSubmit} ref={scrollingRef}>
            <Card className={classes.card} title="Display settings">
              <PrimaryForm />
            </Card>
            <Card className={classes.card} title="Metadata">
              <MetadataForm />
            </Card>
            <Card className={classes.card} title="Indexing and notifications">
              <IndexingAndNotificationsForm settings={settings} />
            </Card>
            <Card className={classes.card}>
              <PreviewForm />
            </Card>
            <Card className={classes.card}>
              <M.Typography>
                Longitudinal query configs will be available after creating the bucket
              </M.Typography>
            </Card>
            <input type="submit" style={{ display: 'none' }} />
          </form>
          <StickyActions parentRef={scrollingRef}>
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
              <M.Fade in style={{ transitionDelay: '1000ms' }}>
                <M.Box flexGrow={1} display="flex" pl={2}>
                  <M.CircularProgress size={24} />
                </M.Box>
              </M.Fade>
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
          </StickyActions>
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
          <M.Fade in style={{ transitionDelay: '1000ms' }}>
            <M.Box flexGrow={1} display="flex" pl={2}>
              <M.CircularProgress size={24} />
            </M.Box>
          </M.Fade>
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
}

function BucketFieldSkeleton({ className }: BucketFieldSkeletonProps) {
  return (
    <Card className={className} title={<Skeleton height={16} width={240} />}>
      <Skeleton height={48} />
      <Skeleton height={48} mt={2} />
    </Card>
  )
}

interface CardsPlaceholderProps {
  className: string
}

function CardsPlaceholder({ className }: CardsPlaceholderProps) {
  const classes = useStyles()
  return (
    <div className={className}>
      <BucketFieldSkeleton className={classes.card} />
      <BucketFieldSkeleton className={classes.card} />
      <BucketFieldSkeleton className={classes.card} />
      <BucketFieldSkeleton className={classes.card} />
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
      <SubPageHeader back={back}>
        <Skeleton height={32} width={240} />
      </SubPageHeader>
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
  const { push: notify } = Notifications.use()

  const classes = useStyles()
  const [disabled, setDisabled] = React.useState(false)

  type OnSubmit = FF.Config<PrimaryFormValues>['onSubmit'] &
    FF.Config<MetadataFormValues>['onSubmit'] &
    FF.Config<IndexingAndNotificationsFormValues>['onSubmit'] &
    FF.Config<PreviewFormValues>['onSubmit']

  const onSubmit: OnSubmit = React.useCallback(
    async (values, form) => {
      try {
        setDisabled(true)
        const input = R.applySpec(editFormSpec)({
          ...bucketToFormValues(bucket),
          ...values,
        })
        const error = await submit(input)
        if (!error) {
          notify(`Successfully updated ${bucket.name} bucket`)
          form.reset(values)
          setDisabled(false)
          return
        }
        if (error instanceof Error) throw error
        setDisabled(false)
        return parseResponseError(error)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating bucket')
        // eslint-disable-next-line no-console
        console.error(e)
        setDisabled(false)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [bucket, notify, submit],
  )

  const guardNavigation = () =>
    'You have unsaved changes. Discard changes and leave the page?'
  const { dirty, onChange } = OnDirty.use()
  const onTabulatorDirty = React.useCallback(
    (d) => onChange({ modified: { tabulator: true }, dirty: d }),
    [onChange],
  )

  const scrollingRef = React.useRef<HTMLDivElement>(null)
  return (
    <>
      <RRDom.Prompt when={dirty} message={guardNavigation} />
      <Reindex bucket={bucket.name} open={reindexOpen} close={closeReindex} />
      <SubPageHeader back={back} disabled={disabled}>
        {`s3://${bucket.name}`}
      </SubPageHeader>
      <React.Suspense fallback={<CardsPlaceholder className={classes.fields} />}>
        <div className={classes.fields} ref={scrollingRef}>
          <div className={classes.card}>
            <PrimaryCard
              bucket={bucket}
              className={classes.card}
              disabled={disabled}
              onSubmit={onSubmit}
            />
            <MetadataCard
              bucket={bucket}
              className={classes.card}
              disabled={disabled}
              onSubmit={onSubmit}
            />
            <IndexingAndNotificationsCard
              bucket={bucket}
              className={classes.card}
              disabled={disabled}
              onSubmit={onSubmit}
              onReindex={openReindex}
            />
            <PreviewCard
              bucket={bucket}
              className={classes.card}
              disabled={disabled}
              onSubmit={onSubmit}
            />
          </div>
          <OnDirty.Provider>
            <TabulatorCard
              bucket={bucket.name}
              className={classes.card}
              disabled={disabled}
              tabulatorTables={tabulatorTables}
              onDirty={onTabulatorDirty}
            />
          </OnDirty.Provider>
        </div>
      </React.Suspense>
    </>
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
    GQL.useQueryS(TABULATOR_TABLES_QUERY, { bucket: bucketName }).bucketConfig
      ?.tabulatorTables || []
  const submit = React.useCallback(
    async (input: Model.GQLTypes.BucketUpdateInput) => {
      if (!bucket) return new Error('Submit form without bucket')
      try {
        const { bucketUpdate: r } = await update({ name: bucket.name, input })
        if (r.__typename !== 'BucketUpdateSuccess') {
          // Generated `InputError` lacks optional properties and not inferred correctly
          return r as Exclude<
            Model.GQLTypes.BucketUpdateResult,
            Model.GQLTypes.BucketUpdateSuccess
          >
        }
      } catch (e) {
        return e instanceof Error ? e : new Error('Error updating bucket')
      }
    },
    [bucket, update],
  )
  if (!bucket) return <RRDom.Redirect to={urls.adminBuckets()} />
  return (
    <OnDirty.Provider>
      <Edit
        bucket={bucket}
        back={back}
        submit={submit}
        tabulatorTables={tabulatorTables}
      />
    </OnDirty.Provider>
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
        if (r.__typename !== 'BucketAddSuccess') {
          // TS inferred shape but not the actual type
          return r as Exclude<
            Model.GQLTypes.BucketAddResult,
            Model.GQLTypes.BucketAddSuccess
          >
        }
        push(`Bucket "${r.bucketConfig.name}" added`)
        track('WEB', {
          type: 'admin',
          action: 'bucket add',
          bucket: r.bucketConfig.name,
        })
      } catch (e) {
        return e instanceof Error ? e : new Error('Error adding bucket')
      }
    },
    [add, push, track],
  )
  return <Add settings={settings} back={back} submit={submit} />
}

function useIsAddPage() {
  const location = RRDom.useLocation()
  const params = parseSearch(location.search)
  return !!params.add
}

interface BucketsProps {
  back: () => void
}

function Buckets({ back }: BucketsProps) {
  const isAddPage = useIsAddPage()
  if (isAddPage) {
    return (
      <React.Suspense fallback={<AddPageSkeleton back={back} />}>
        <AddPage back={back} />
      </React.Suspense>
    )
  }
  return (
    <React.Suspense fallback={<ListPageSkeleton />}>
      <ListPage />
    </React.Suspense>
  )
}

export default function BucketsRouter() {
  const history = RRDom.useHistory()
  const { paths, urls } = NamedRoutes.use()
  const back = React.useCallback(() => history.push(urls.adminBuckets()), [history, urls])
  return (
    <M.Box mt={2} mb={2}>
      <MetaTitle>{['Buckets', 'Admin']}</MetaTitle>
      <RRDom.Switch>
        <RRDom.Route path={paths.adminBucketEdit} exact strict>
          <React.Suspense fallback={<EditPageSkeleton back={back} />}>
            <EditPage back={back} />
          </React.Suspense>
        </RRDom.Route>
        <RRDom.Route>
          <Buckets back={back} />
        </RRDom.Route>
      </RRDom.Switch>
    </M.Box>
  )
}
