import * as dateFns from 'date-fns'
import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as IO from 'io-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RRDom from 'react-router-dom'
import useResizeObserver from 'use-resize-observer'
import { useDebounce } from 'use-debounce'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import BucketIcon from 'components/BucketIcon'
import * as Dialog from 'components/Dialog'
import * as Pagination from 'components/Pagination'
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import Delay from 'utils/Delay'
import * as Dialogs from 'utils/Dialogs'
import type FormSpec from 'utils/FormSpec'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledTooltip from 'utils/StyledTooltip'
import assertNever from 'utils/assertNever'
import parseSearch from 'utils/parseSearch'
import { useTracker } from 'utils/tracking'
import * as Types from 'utils/types'
import * as validators from 'utils/validators'

import * as Form from '../Form'
import * as Table from '../Table'

import BUCKET_CONFIGS_QUERY from './gql/BucketConfigs.generated'
import ADD_MUTATION from './gql/BucketsAdd.generated'
import UPDATE_MUTATION from './gql/BucketsUpdate.generated'
import REMOVE_MUTATION from './gql/BucketsRemove.generated'
import { BucketConfigSelectionFragment as BucketConfig } from './gql/BucketConfigSelection.generated'
import CONTENT_INDEXING_SETTINGS_QUERY from './gql/ContentIndexingSettings.generated'

const useFormActionsStyles = M.makeStyles((t) => ({
  actions: {
    animation: `$show 150ms ease-out`,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: t.spacing(2, 1),
    '& > * + *': {
      marginLeft: t.spacing(2),
    },
  },
  placeholder: {
    height: 64,
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
// 2. Get the bottom of this element and debounce the value
// 3. If the bottom is below the viewport, make the element `position: "fixed"`
function FormActions({ children, siblingRef }: FormActionsProps) {
  const classes = useFormActionsStyles()
  const { height: siblingHeight } = useResizeObserver({ ref: siblingRef })
  const ref = React.useRef<HTMLDivElement>(null)
  const [bottom, setBottom] = React.useState(0)
  const handleScroll = React.useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !rect.width) return
    setBottom(rect.bottom)
  }, [])
  const DEBOUNCE_TIMEOUT = 150
  const [debouncedBottom] = useDebounce(bottom, DEBOUNCE_TIMEOUT)
  const sticky = React.useMemo(
    () =>
      debouncedBottom >= (window.innerHeight || document.documentElement.clientHeight),
    [debouncedBottom],
  )
  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  React.useEffect(() => handleScroll(), [handleScroll, siblingHeight])
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
    '& li::before': {
      content: 'none',
    },
  },
})

interface SubPageHeaderProps {
  back: () => void
  children: React.ReactNode
  danger?: boolean
  submit: () => void
}

function SubPageHeader({ back, children, danger, submit }: SubPageHeaderProps) {
  const classes = useSubPageHeaderStyles()
  const confirm = Dialog.useConfirm({
    cancelTitle: 'Discard',
    onSubmit: (confirmed) => (confirmed ? submit() : back()),
    submitTitle: 'Save',
    title: 'You have unsaved changes',
  })
  return (
    <>
      {confirm.render(<></>)}
      <M.Breadcrumbs className={classes.root}>
        <M.Button
          onClick={() => (danger ? confirm.open() : back())}
          variant="outlined"
          startIcon={<M.Icon>arrow_back</M.Icon>}
          size="small"
        >
          Back to buckets
        </M.Button>
        <M.Typography variant="h6" color="textPrimary">
          {children}
        </M.Typography>
      </M.Breadcrumbs>
    </>
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

const useBucketFieldsStyles = M.makeStyles((t) => ({
  primary: {
    padding: t.spacing(2),
  },
  secondary: {
    marginTop: t.spacing(2),
  },
  section: {
    flexDirection: 'column',
  },
  warning: {
    background: t.palette.warning.main,
    marginBottom: t.spacing(1),
    marginTop: t.spacing(2),
  },
  warningIcon: {
    color: t.palette.warning.dark,
  },
}))

interface BucketFieldsProps {
  bucket?: BucketConfig
  reindex?: () => void
  className: string
}

function BucketFields({ bucket, className, reindex }: BucketFieldsProps) {
  const classes = useBucketFieldsStyles()

  const data = GQL.useQueryS(CONTENT_INDEXING_SETTINGS_QUERY)
  const settings = data.config.contentIndexingSettings

  return (
    <div className={className}>
      <M.Paper className={classes.primary}>
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
      </M.Paper>
      <div className={classes.secondary}>
        <M.Accordion>
          <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
            <M.Typography variant="h6">Metadata</M.Typography>
          </M.AccordionSummary>
          <M.AccordionDetails className={classes.section}>
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
          </M.AccordionDetails>
        </M.Accordion>
        <M.Accordion>
          <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
            <M.Typography variant="h6">Indexing and notifications</M.Typography>
          </M.AccordionSummary>
          <M.AccordionDetails className={classes.section}>
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
                    Deep indexing adds the <em>contents</em> of an object to your search
                    index, while shallow indexing only covers object metadata. Deep
                    indexing may require more disk in ElasticSearch. Enable deep indexing
                    when you want your users to find files by their contents.
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
                    R.equals(
                      bucket.indexContentBytes,
                      editFormSpec.indexContentBytes(values),
                    )
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
                    Changing these settings affects files that are indexed after the
                    change. If you wish to deep index existing files, click{' '}
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
                            Enter an integer from {settings.bytesMin} to{' '}
                            {settings.bytesMax}
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
              parse={R.pipe(
                R.replace(/[^0-9]/g, ''),
                R.take(16) as (s: string) => string,
              )}
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
          </M.AccordionDetails>
        </M.Accordion>
        <M.Accordion>
          <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
            <M.Typography variant="h6">File preview options</M.Typography>
          </M.AccordionSummary>
          <M.AccordionDetails className={classes.section}>
            <RF.Field component={PFSCheckbox} name="browsable" type="checkbox" />
          </M.AccordionDetails>
        </M.Accordion>
      </div>
    </div>
  )
}

function BucketFieldsPlaceholder() {
  return (
    <>
      {R.times(
        (i) => (
          <Skeleton key={i} height={48} mt={i ? 3 : 0} />
        ),
        5,
      )}
    </>
  )
}

const useAddStyles = M.makeStyles((t) => ({
  fields: {
    marginTop: t.spacing(2),
  },
}))

interface AddProps {
  back: (reason?: string) => void
}

function Add({ back }: AddProps) {
  const { push } = Notifications.use()
  const t = useTracker()
  const add = GQL.useMutation(ADD_MUTATION)
  const classes = useAddStyles()
  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const input = R.applySpec(addFormSpec)(values)
        const { bucketAdd: r } = await add({ input })
        switch (r.__typename) {
          case 'BucketAddSuccess':
            push(`Bucket "${r.bucketConfig.name}" added`)
            t.track('WEB', {
              type: 'admin',
              action: 'bucket add',
              bucket: r.bucketConfig.name,
            })
            back()
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
          case 'SubscriptionInvalid':
            return { [FF.FORM_ERROR]: 'subscriptionInvalid' }
          case 'BucketIndexContentBytesInvalid':
            // shouldnt happen since we valide input
            return { indexContentBytes: 'integerInRange' }
          case 'BucketFileExtensionsToIndexInvalid':
            // shouldnt happen since we valide input
            return { fileExtensionsToIndex: 'validExtensions' }
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
    [add, push, back, t],
  )

  const formRef = React.useRef<HTMLFormElement>(null)

  return (
    <RF.Form onSubmit={onSubmit} initialValues={{ enableDeepIndexing: true }}>
      {({
        handleSubmit,
        submitting,
        submitFailed,
        error,
        submitError,
        hasValidationErrors,
        pristine,
      }) => (
        <>
          <SubPageHeader danger={!pristine} back={back} submit={handleSubmit}>
            Add a bucket
          </SubPageHeader>
          <React.Suspense fallback={<BucketFieldsPlaceholder />}>
            <form onSubmit={handleSubmit} ref={formRef}>
              <BucketFields className={classes.fields} />
              {submitFailed && (
                <Form.FormError
                  error={error || submitError}
                  errors={{
                    unexpected: 'Something went wrong',
                    notificationConfigurationError: 'Notification configuration error',
                    insufficientPermissions: 'Insufficient permissions',
                    subscriptionInvalid: 'Subscription invalid',
                  }}
                />
              )}
              <input type="submit" style={{ display: 'none' }} />
            </form>
          </React.Suspense>
          <FormActions siblingRef={formRef}>
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

const useEditStyles = M.makeStyles((t) => ({
  breadcrumbs: {
    '& li::before': {
      content: 'none',
    },
  },
  fields: {
    marginTop: t.spacing(2),
  },
}))

interface EditProps {
  bucket: BucketConfig
  close: (reason?: string) => void
}

function Edit({ bucket, close }: EditProps) {
  const update = GQL.useMutation(UPDATE_MUTATION)

  const [reindexOpen, setReindexOpen] = React.useState(false)
  const openReindex = React.useCallback(() => setReindexOpen(true), [])
  const closeReindex = React.useCallback(() => setReindexOpen(false), [])

  const classes = useEditStyles()

  const onSubmit = React.useCallback(
    async (values) => {
      try {
        const input = R.applySpec(editFormSpec)(values)
        const { bucketUpdate: r } = await update({ name: bucket.name, input })
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
          case 'BucketIndexContentBytesInvalid':
            // shouldnt happen since we valide input
            return { indexContentBytes: 'integerInRange' }
          case 'BucketFileExtensionsToIndexInvalid':
            // shouldnt happen since we valide input
            return { fileExtensionsToIndex: 'validExtensions' }
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
  }

  const formRef = React.useRef<HTMLFormElement>(null)

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
          <SubPageHeader danger={!pristine} back={close} submit={handleSubmit}>
            Edit the &quot;{bucket.name}&quot; bucket
          </SubPageHeader>
          <React.Suspense fallback={<BucketFieldsPlaceholder />}>
            <form onSubmit={handleSubmit} ref={formRef}>
              <BucketFields
                className={classes.fields}
                bucket={bucket}
                reindex={openReindex}
              />
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
          </React.Suspense>
          <FormActions siblingRef={formRef}>
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
              variant="contained"
            >
              Save
            </M.Button>
          </FormActions>
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
  const rm = GQL.useMutation(REMOVE_MUTATION)
  const doDelete = React.useCallback(async () => {
    close()
    try {
      const { bucketRemove: r } = await rm({ name: bucket.name })
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

function List() {
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

  const location = RRDom.useLocation()
  const params = parseSearch(location.search)
  const bucketName = Array.isArray(params.bucket) ? params.bucket[0] : params.bucket
  if (bucketName) {
    return <RRDom.Redirect to={urls.adminBucketEdit(bucketName)} />
  }

  const toolbarActions = [
    {
      title: 'Add bucket',
      icon: <M.Icon>add</M.Icon>,
      fn: () => history.push(urls.adminBucketAdd()),
    },
  ]

  const edit = (bucket: BucketConfig) => () =>
    history.push(urls.adminBucketEdit(bucket.name))

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

interface EditRouteParams {
  bucketName: string
}

function EditWrapper() {
  const { bucketName } = RRDom.useParams<EditRouteParams>()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const { bucketConfigs: rows } = GQL.useQueryS(BUCKET_CONFIGS_QUERY)
  const editingBucket = React.useMemo(
    () => (bucketName ? rows.find(({ name }) => name === bucketName) : null),
    [bucketName, rows],
  )
  if (!bucketName || !editingBucket) {
    return <RRDom.Redirect to={urls.adminBuckets()} />
  }
  return <Edit bucket={editingBucket} close={() => history.push(urls.adminBuckets())} />
}

export default function Buckets() {
  const history = RRDom.useHistory()
  const { paths, urls } = NamedRoutes.use()
  return (
    <M.Box mt={2} mb={2}>
      <MetaTitle>{['Buckets', 'Admin']}</MetaTitle>
      <RRDom.Switch>
        <RRDom.Route path={paths.adminBucketAdd} exact strict>
          <Add back={() => history.push(urls.adminBuckets())} />
        </RRDom.Route>
        <RRDom.Route path={paths.adminBucketEdit} exact strict>
          <React.Suspense fallback={<M.CircularProgress />}>
            <EditWrapper />
          </React.Suspense>
        </RRDom.Route>
        <RRDom.Route>
          <React.Suspense
            fallback={
              <M.Paper>
                <Table.Toolbar heading="Buckets" />
                <Table.Progress />
              </M.Paper>
            }
          >
            <List />
          </React.Suspense>
        </RRDom.Route>
      </RRDom.Switch>
    </M.Box>
  )
}
