import cx from 'classnames'
import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import { useTracker } from 'utils/tracking'

import * as Form from '../Form'
import * as OnDirty from './OnDirty'

import {
  IndexingAndNotificationsForm,
  MetadataForm,
  PreviewForm,
  PrimaryForm,
  addFormSpec,
  parseResponseError,
  SubPageHeader,
} from './BucketForm'
import BucketPage from './BucketPage'
import ListPage, { ListSkeleton as ListPageSkeleton } from './List'

import BUCKET_CONFIGS_QUERY from './gql/BucketConfigs.generated'
import ADD_MUTATION from './gql/BucketsAdd.generated'
import UPDATE_MUTATION from './gql/BucketsUpdate.generated'
import CONTENT_INDEXING_SETTINGS_QUERY from './gql/ContentIndexingSettings.generated'
import TABULATOR_TABLES_QUERY from './gql/TabulatorTables.generated'

const useStickyActionsStyles = M.makeStyles((t) => ({
  actions: {
    alignItems: 'center',
    bottom: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    position: 'sticky',
    transition: t.transitions.create(['box-shadow', 'padding'], { duration: 150 }),
    '& > * + *': {
      // Spacing between direct children
      marginLeft: t.spacing(2),
    },
  },
  floating: {
    backgroundColor: t.palette.background.paper,
    borderRadius: t.shape.borderRadius,
    boxShadow: t.shadows[8],
    padding: t.spacing(2),
  },
  resting: {
    padding: t.spacing(3, 0, 0),
  },
  sentinel: {
    height: 1,
    marginTop: -1,
  },
}))

interface StickyActionsProps {
  children: React.ReactNode
}

function StickyActions({ children }: StickyActionsProps) {
  const classes = useStickyActionsStyles()

  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = React.useState(false)

  // The sentinel sits just past the bar's resting place, so it is out of view
  // for exactly as long as the bar is pinned. 1px, not 0: a zero-area target's
  // intersection is unreliable.
  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return undefined
    const observer = new IntersectionObserver(([entry]) =>
      setPinned(!entry.isIntersecting),
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div className={cx(classes.actions, pinned ? classes.floating : classes.resting)}>
        {children}
      </div>
      <div className={classes.sentinel} ref={sentinelRef} />
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-redeclare

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
      variant="outlined"
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
  return (
    <div>
      <SubPageHeader back={back}>Add a bucket</SubPageHeader>
      <CardsPlaceholder className={classes.fields} />
      <StickyActions>
        <Buttons.Skeleton />
        <Buttons.Skeleton />
      </StickyActions>
    </div>
  )
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
          <form className={classes.fields} onSubmit={handleSubmit}>
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
          <StickyActions>
            {submitFailed && (
              <Form.FormError
                className={classes.error}
                error={error || submitError}
                errors={{
                  unexpected: 'Something went wrong',
                  notificationConfigurationError: 'Notification configuration error',
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

export function EditPageSkeleton({ back }: EditPageSkeletonProps) {
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

interface EditRouteParams {
  bucketName: string
}

interface EditPageProps {
  back: () => void
}

export function EditPage({ back }: EditPageProps) {
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
    // Keyed because this route renders in place when navigation swaps the bucket: the
    // re-index dialog's state is reset by `onExited`, which does not run then, so without
    // a remount the dialog stays open with the previous bucket's prefix. The key sits on
    // the provider rather than on `Edit` because the dirty count only decrements on a
    // form's change event and unmounting the forms sends none, so a count left here would
    // guard the next bucket's pristine forms.
    <OnDirty.Provider key={bucket.name}>
      <BucketPage
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
