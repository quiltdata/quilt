import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as quiltConfigs from 'constants/quiltConfigs'
import type * as Model from 'model'
import * as Dialogs from 'utils/Dialogs'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as Form from '../Form'
import {
  IndexingAndNotificationsForm,
  MetadataForm,
  ObjectTagsForm,
  PFSCheckbox,
  PrimaryForm,
  bucketToFormValues,
  editFormSpec,
  parseResponseError,
  SubPageHeader,
} from './BucketForm'
import { Delete } from './List'
import * as OnDirty from './OnDirty'
import Reindex from './ReindexDialog'
import TabulatorForm from './Tabulator'

import { BucketConfigSelectionFragment as BucketConfig } from './gql/BucketConfigSelection.generated'
import CONTENT_INDEXING_SETTINGS_QUERY from './gql/ContentIndexingSettings.generated'

type FormValues = ReturnType<typeof bucketToFormValues>

// Which section a field belongs to, so a changed field marks its own section and the
// save bar can name where the changes are. Field names are final-form's, from the
// form bodies in Buckets.tsx.
const SECTION_OF: Record<keyof FormValues, SectionId> = {
  title: 'display',
  iconUrl: 'display',
  description: 'display',
  relevanceScore: 'find',
  tags: 'find',
  enableDeepIndexing: 'index',
  fileExtensionsToIndex: 'index',
  indexContentBytes: 'index',
  scannerParallelShardsDepth: 'index',
  prefixes: 'index',
  snsNotificationArn: 'index',
  skipMetaDataIndexing: 'index',
  browsable: 'render',
  objectTagsConfig: 'tags',
}

type SectionId = 'display' | 'find' | 'index' | 'render' | 'tags'

const SECTION_TITLE: Record<SectionId, string> = {
  display: 'How it appears',
  find: 'How it is found',
  index: 'What gets indexed, and how changes arrive',
  render: 'How files render',
  tags: 'Which metadata becomes S3 tags',
}

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(2, 3),
    padding: t.spacing(2, 3),
  },
  identity: {
    flex: '1 1 320px',
    minWidth: 0,
  },
  name: {
    ...t.typography.h5,
    fontFamily: t.typography.monospace.fontFamily,
    overflowWrap: 'anywhere',
  },
  title: {
    color: t.palette.text.secondary,
    marginTop: t.spacing(0.5),
  },
  actions: {
    alignSelf: 'flex-start',
    display: 'flex',
    flex: '0 0 auto',
    gap: t.spacing(1),
    // With the identity block wrapped above, the actions read as a row of the
    // header rather than a stray control at the page's edge.
    marginLeft: 'auto',
  },
}))

interface HeaderProps {
  bucket: BucketConfig
  disabled: boolean
  onDelete: () => void
  onReindex: () => void
}

function Header({ bucket, disabled, onDelete, onReindex }: HeaderProps) {
  const classes = useHeaderStyles()
  return (
    <M.Paper className={classes.root} variant="outlined">
      <div className={classes.identity}>
        <M.Typography component="h1" className={classes.name}>
          s3://{bucket.name}
        </M.Typography>
        {bucket.title !== bucket.name && (
          <M.Typography variant="body2" className={classes.title}>
            {bucket.title}
          </M.Typography>
        )}
      </div>
      <div className={classes.actions}>
        <M.Button variant="outlined" disabled={disabled} onClick={onReindex}>
          Re-index…
        </M.Button>
        <M.Button variant="outlined" disabled={disabled} onClick={onDelete}>
          Delete…
        </M.Button>
      </div>
    </M.Paper>
  )
}

const useStateStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gap: t.spacing(2, 3),
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    padding: t.spacing(2, 3),
  },
  label: {
    ...t.typography.overline,
    color: t.palette.text.secondary,
    display: 'block',
  },
  value: {
    ...t.typography.body1,
    marginTop: t.spacing(0.5),
  },
  note: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    display: 'block',
    marginTop: t.spacing(0.5),
  },
  stale: {
    color: t.palette.warning.dark,
  },
}))

interface ReadoutProps {
  label: string
  value: React.ReactNode
  note: React.ReactNode
}

function Readout({ label, value, note }: ReadoutProps) {
  const classes = useStateStyles()
  return (
    <div>
      <span className={classes.label}>{label}</span>
      <div className={classes.value}>{value}</div>
      <span className={classes.note}>{note}</span>
    </div>
  )
}

interface StateProps {
  bucket: BucketConfig
}

// Four readouts from fields the record already carries. Nothing here is a guess: the
// scanner keeps no total, so no percentage exists to show, and "last indexed" is
// the finish time of the last shard, which is what the note says.
function State({ bucket }: StateProps) {
  const classes = useStateStyles()
  const { urls } = NamedRoutes.use()
  const deep =
    !R.equals(bucket.fileExtensionsToIndex, []) && bucket.indexContentBytes !== 0
  // Three states, not two: a null ARN is a bucket nobody has configured either way,
  // which is not the same claim as "subscribed" and carries the same staleness risk.
  const subscribed = bucket.snsNotificationArn
    ? bucket.snsNotificationArn !== 'DO_NOT_SUBSCRIBE'
    : null
  const scope = (bucket.prefixes || []).filter((p) => p)
  return (
    <M.Paper className={classes.root} variant="outlined">
      <Readout
        label="Last indexed"
        value={
          bucket.lastIndexed ? (
            <span title={bucket.lastIndexed.toLocaleString()}>
              {dateFns.formatDistanceToNow(bucket.lastIndexed, { addSuffix: true })}
            </span>
          ) : (
            'Never'
          )
        }
        note="The finish time of the last shard, not the moment the bucket was fully covered."
      />
      <Readout
        label="Scan"
        value={
          <StyledLink to={`${urls.adminStatus()}#indexing`}>View scanner jobs</StyledLink>
        }
        note="A running scan shows where it resumes from, never a percentage: the only thing stored is a resume cursor."
      />
      <Readout
        label="Notifications"
        value={
          subscribed === null ? (
            <span className={classes.stale}>Not configured</span>
          ) : subscribed ? (
            'Subscribed'
          ) : (
            <span className={classes.stale}>Skipped</span>
          )
        }
        note={
          subscribed
            ? 'New objects reach the index without a re-scan.'
            : 'New objects reach the index only on the next bulk scan, so the bucket goes quietly stale.'
        }
      />
      <Readout
        label="Deep indexing"
        value={deep ? 'On' : 'Off'}
        note={
          scope.length
            ? `Bulk scans cover ${scope.length === 1 ? 'one prefix' : `${scope.length} prefixes`}; writes elsewhere are still indexed.`
            : 'Bulk scans cover the whole bucket.'
        }
      />
    </M.Paper>
  )
}

const useSectionStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    '&:last-child': {
      borderBottom: 0,
    },
  },
  head: {
    alignItems: 'center',
    background: 'none',
    border: 0,
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    font: 'inherit',
    gap: t.spacing(1.5),
    minHeight: 56,
    padding: t.spacing(1, 3),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  chevron: {
    color: t.palette.text.secondary,
    flex: '0 0 auto',
    transition: t.transitions.create('transform', { duration: 150 }),
  },
  open: {
    transform: 'rotate(90deg)',
  },
  name: {
    ...t.typography.subtitle1,
    fontWeight: 500,
  },
  changed: {
    ...t.typography.caption,
    border: `1px solid ${t.palette.warning.dark}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.warning.dark,
    lineHeight: 1.4,
    padding: t.spacing(0, 0.75),
  },
  summary: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginLeft: 'auto',
    overflow: 'hidden',
    textAlign: 'right',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  body: {
    padding: t.spacing(0, 3, 3, 8),
  },
}))

interface SectionProps {
  id: SectionId
  summary: string
  changed: boolean
  open: boolean
  onToggle: (id: SectionId) => void
  children: React.ReactNode
}

function Section({ id, summary, changed, open, onToggle, children }: SectionProps) {
  const classes = useSectionStyles()
  const bodyId = `bucket-section-${id}`
  return (
    <div className={classes.root}>
      <button
        type="button"
        className={classes.head}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onToggle(id)}
      >
        <M.Icon
          className={cx(classes.chevron, { [classes.open]: open })}
          fontSize="small"
        >
          chevron_right
        </M.Icon>
        <span className={classes.name}>{SECTION_TITLE[id]}</span>
        {changed && <span className={classes.changed}>changed</span>}
        <span className={classes.summary}>{summary}</span>
      </button>
      <M.Collapse in={open} unmountOnExit={false}>
        <div id={bodyId} className={classes.body}>
          {children}
        </div>
      </M.Collapse>
    </div>
  )
}

// A field error inside a collapsed section is invisible and the save bar names only
// form-level errors, so a rejected save would read as nothing having happened.
function RevealErrors({ reveal }: { reveal: (ids: SectionId[]) => void }) {
  const { submitFailed, errors, submitErrors } = RF.useFormState({
    subscription: { submitFailed: true, errors: true, submitErrors: true },
  })
  const ids = React.useMemo(() => {
    if (!submitFailed) return ''
    const all: Record<string, unknown> = { ...errors, ...submitErrors }
    return Object.keys(all)
      .filter((f) => all[f] && f in SECTION_OF)
      .map((f) => SECTION_OF[f as keyof FormValues])
      .join(',')
  }, [submitFailed, errors, submitErrors])
  React.useEffect(() => {
    if (ids) reveal(ids.split(',') as SectionId[])
  }, [ids, reveal])
  return null
}

const useSaveBarStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderTop: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    padding: t.spacing(1.5, 3),
    position: 'sticky',
    bottom: 0,
    background: t.palette.background.paper,
  },
  armed: {
    borderTopColor: t.palette.warning.dark,
    background: t.palette.warning.light,
  },
  status: {
    ...t.typography.body2,
    flex: '1 1 200px',
  },
}))

interface SaveBarProps {
  form: FF.FormApi<FormValues>
  changedSections: SectionId[]
}

function SaveBar({ form, changedSections }: SaveBarProps) {
  const classes = useSaveBarStyles()
  const state = form.getState()
  const n = Object.values(state.dirtyFields).filter(Boolean).length
  const armed = n > 0
  const error = (() => {
    if (!state.submitFailed) return
    if (state.error || state.submitError) return state.error || state.submitError
    // A field-level error with no field rendering it would otherwise fail the save
    // silently, since this bar is the only place a submit failure is reported.
    if (state.submitErrors)
      return `Unhandled error: ${JSON.stringify(state.submitErrors)}`
    // Validation errors are the field's own and are rendered there; the bar only has to
    // say why nothing was submitted, not restate them.
    return 'Some fields need fixing before this can be saved'
  })()
  return (
    <div className={cx(classes.root, { [classes.armed]: armed })}>
      <span className={classes.status} role="status">
        {error ? (
          <Form.FormError
            error={error}
            errors={{
              unexpected: 'Something went wrong',
              notificationConfigurationError: 'Notification configuration error',
              bucketNotFound: 'Bucket not found',
              subscriptionInvalid: 'Subscription invalid',
            }}
            margin="none"
          />
        ) : armed ? (
          `${n} unsaved ${n === 1 ? 'change' : 'changes'} in ${changedSections
            .map((s) => SECTION_TITLE[s])
            .join(', ')}`
        ) : (
          'No unsaved changes'
        )}
      </span>
      {state.submitting && <M.CircularProgress size={20} />}
      <M.Button
        color="primary"
        disabled={!armed || state.submitting}
        onClick={() => form.reset()}
      >
        Discard
      </M.Button>
      <M.Button
        color="primary"
        variant="contained"
        disabled={
          !armed || state.submitting || (state.submitFailed && state.hasValidationErrors)
        }
        onClick={() => form.submit()}
      >
        Save bucket
      </M.Button>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  block: {
    marginTop: t.spacing(2),
  },
  heading: {
    ...t.typography.h6,
    marginBottom: t.spacing(1),
    marginTop: t.spacing(3),
  },
  sections: {
    // The save bar is sticky against this paper's bottom edge; the paper must not
    // clip it away.
    overflow: 'visible',
  },
  tabulator: {
    padding: t.spacing(2, 3),
  },
}))

// The symbol is the explicit skip; an empty value is a bucket with no topic set, which
// this summary would otherwise report as subscribed.
const notificationsLabel = (arn: FormValues['snsNotificationArn']) => {
  if (typeof arn === 'symbol') return 'skipped'
  return arn ? 'subscribed' : 'not configured'
}

function summarize(v: FormValues, bucket: BucketConfig): Record<SectionId, string> {
  // Clearing a text field makes react-final-form parse it to `undefined`, and this
  // readout renders on every keystroke, so an unguarded read crashes the whole panel.
  const scope = (v.prefixes ?? '').split('\n').filter((p) => p.trim()).length
  return {
    display: v.title || bucket.name,
    find: `relevance ${v.relevanceScore || '0'}${v.tags ? ` · ${v.tags.split(',').filter((x) => x.trim()).length} tags` : ' · no tags'}`,
    index: `deep indexing ${v.enableDeepIndexing ? 'on' : 'off'} · ${scope ? `${scope} ${scope === 1 ? 'prefix' : 'prefixes'}` : 'whole bucket'} · notifications ${notificationsLabel(v.snsNotificationArn)}`,
    render: v.browsable ? 'permissive HTML on' : 'permissive HTML off',
    tags: v.objectTagsConfig?.trim() ? 'mapped' : 'none',
  }
}

interface BucketPageProps {
  bucket: BucketConfig
  back: () => void
  submit: (
    input: Model.GQLTypes.BucketUpdateInput,
  ) => Promise<
    | Exclude<Model.GQLTypes.BucketUpdateResult, Model.GQLTypes.BucketUpdateSuccess>
    | Error
    | undefined
  >
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
}

export default function BucketPage({
  bucket,
  back,
  submit,
  tabulatorTables,
}: BucketPageProps) {
  const classes = useStyles()
  const { push: notify } = Notifications.use()
  const data = GQL.useQueryS(CONTENT_INDEXING_SETTINGS_QUERY)
  const settings = data.config.contentIndexingSettings
  const { open: openDialog, render: renderDialogs } = Dialogs.use()

  const [reindexOpen, setReindexOpen] = React.useState(false)
  const { urls } = NamedRoutes.use()
  const configHref = urls.bucketFile(bucket.name, quiltConfigs.bucketPreferences[0], {
    edit: true,
  })
  const [open, setOpen] = React.useState<Record<SectionId, boolean>>({
    display: true,
    find: false,
    index: false,
    render: false,
    tags: false,
  })
  const toggle = React.useCallback(
    (id: SectionId) => setOpen((o) => ({ ...o, [id]: !o[id] })),
    [],
  )
  const reveal = React.useCallback(
    (ids: SectionId[]) =>
      setOpen((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, true])) })),
    [],
  )

  const initialValues = React.useMemo(() => bucketToFormValues(bucket), [bucket])

  // One form, one write: every section's fields live in the same final-form instance,
  // so a title and a relevance score changed together are one mutation and one toast.
  const onSubmit = React.useCallback(
    async (values: FormValues, form: FF.FormApi<FormValues>) => {
      try {
        const input = R.applySpec(editFormSpec)(values)
        const error = await submit(input)
        if (!error) {
          notify(`Saved ${bucket.name}`)
          form.reset(values)
          return
        }
        if (error instanceof Error) throw error
        return parseResponseError(error)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating bucket', e)
        return { [FF.FORM_ERROR]: 'unexpected' }
      }
    },
    [bucket.name, notify, submit],
  )

  const { dirty: tabulatorDirty, onChange } = OnDirty.use()
  const onTabulatorDirty = React.useCallback(
    (d: boolean) => onChange({ modified: { tabulator: true }, dirty: d }),
    [onChange],
  )

  // Navigating away after a delete would otherwise trip the unsaved-changes Prompt, asking
  // the user to confirm discarding edits to a bucket that no longer exists.
  const [deleted, setDeleted] = React.useState(false)
  // Navigating from the effect rather than alongside `setDeleted`: the Prompt must have
  // rendered with `deleted` before the history change, and whether two updates in one
  // handler flush in that order is a React batching detail, not something to rely on.
  React.useEffect(() => {
    if (deleted) back()
  }, [back, deleted])
  const onDelete = React.useCallback(() => {
    openDialog(({ close }) => (
      <Delete bucket={bucket} close={close} onDeleted={() => setDeleted(true)} />
    ))
  }, [bucket, openDialog])

  return (
    <RF.Form<FormValues>
      onSubmit={onSubmit}
      initialValues={initialValues}
      // `initialValues` is rebuilt whenever the bucket query result changes identity, and
      // a reinitialize would otherwise silently drop whatever the user has typed.
      keepDirtyOnReinitialize
    >
      {({ handleSubmit, form, dirty, submitting, values, dirtyFields }) => {
        const changed = new Set<SectionId>()
        for (const [field, isDirty] of Object.entries(dirtyFields)) {
          if (isDirty && field in SECTION_OF)
            changed.add(SECTION_OF[field as keyof FormValues])
        }
        const changedSections = (Object.keys(SECTION_TITLE) as SectionId[]).filter((s) =>
          changed.has(s),
        )
        const summary = summarize(values, bucket)
        return (
          <>
            <RRDom.Prompt
              when={!deleted && (dirty || tabulatorDirty)}
              message="You have unsaved changes. Discard changes and leave the page?"
            />
            {renderDialogs({ maxWidth: 'xs', fullWidth: true })}
            <Reindex
              bucket={bucket.name}
              open={reindexOpen}
              close={() => setReindexOpen(false)}
            />
            <SubPageHeader back={back} disabled={submitting}>
              Bucket
            </SubPageHeader>

            <div className={classes.block}>
              <Header
                bucket={bucket}
                disabled={submitting}
                onDelete={onDelete}
                onReindex={() => setReindexOpen(true)}
              />
            </div>

            <M.Typography component="h2" className={classes.heading}>
              State
            </M.Typography>
            <State bucket={bucket} />

            <M.Typography component="h2" className={classes.heading}>
              Settings
            </M.Typography>
            <M.Paper variant="outlined" className={classes.sections}>
              <form onSubmit={handleSubmit}>
                <RevealErrors reveal={reveal} />
                <Section
                  id="display"
                  summary={summary.display}
                  changed={changed.has('display')}
                  open={open.display}
                  onToggle={toggle}
                >
                  <PrimaryForm bucket={bucket} />
                  <M.Box mt={2}>
                    <M.Typography variant="body2">
                      <StyledLink to={configHref}>Configure Bucket UI</StyledLink>
                    </M.Typography>
                  </M.Box>
                </Section>
                <Section
                  id="find"
                  summary={summary.find}
                  changed={changed.has('find')}
                  open={open.find}
                  onToggle={toggle}
                >
                  <MetadataForm />
                </Section>
                <Section
                  id="index"
                  summary={summary.index}
                  changed={changed.has('index')}
                  open={open.index}
                  onToggle={toggle}
                >
                  <IndexingAndNotificationsForm bucket={bucket} settings={settings} />
                </Section>
                <Section
                  id="render"
                  summary={summary.render}
                  changed={changed.has('render')}
                  open={open.render}
                  onToggle={toggle}
                >
                  <RF.Field component={PFSCheckbox} name="browsable" type="checkbox" />
                </Section>
                <Section
                  id="tags"
                  summary={summary.tags}
                  changed={changed.has('tags')}
                  open={open.tags}
                  onToggle={toggle}
                >
                  <ObjectTagsForm />
                </Section>
                <input type="submit" style={{ display: 'none' }} />
              </form>
              <SaveBar form={form} changedSections={changedSections} />
            </M.Paper>

            <M.Typography component="h2" className={classes.heading}>
              Longitudinal query tables
            </M.Typography>
            <M.Paper variant="outlined" className={classes.tabulator}>
              <OnDirty.Provider>
                <TabulatorDirtyBridge onDirty={onTabulatorDirty} />
                <TabulatorForm bucket={bucket.name} tables={tabulatorTables} />
              </OnDirty.Provider>
            </M.Paper>
          </>
        )
      }}
    </RF.Form>
  )
}

interface TabulatorDirtyBridgeProps {
  onDirty: (dirty: boolean) => void
}

// Tabulator saves through its own mutations and tracks its own dirtiness inside a
// nested provider; this lifts that flag out so the page's leave-guard sees it.
function TabulatorDirtyBridge({ onDirty }: TabulatorDirtyBridgeProps) {
  const { dirty } = OnDirty.use()
  React.useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])
  return null
}
