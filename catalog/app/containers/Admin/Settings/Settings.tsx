import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as Sentry from '@sentry/react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import * as M from '@material-ui/core'

import SubmitSpinner from 'containers/Bucket/PackageDialog/SubmitSpinner'
import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import { useFeature } from 'utils/features'
import MetaTitle from 'utils/MetaTitle'
import * as validators from 'utils/validators'

import * as Form from '../Form'
import DataProductConnections from './DataProductConnections'
import FeatureSettings, { HAS_PREVIEW_FEATURES } from './FeatureSettings'
import PackagerSettings from './PackagerSettings'
import QuratorSettings from './QuratorSettings'
import SearchSettings from './SearchSettings'
import SupportDiagnostics from './SupportDiagnostics'
import TabulatorSettings from './TabulatorSettings'
import ThemeEditor from './ThemeEditor'

function useBeta(): [boolean, (b: boolean) => Promise<void>] {
  const settings = CatalogSettings.use()
  const writeSettings = CatalogSettings.useWriteSettings()
  const onChange = React.useCallback(
    (beta: boolean) =>
      writeSettings(
        {
          ...settings,
          beta,
        },
        settings,
      ),
    [settings, writeSettings],
  )
  return [settings?.beta || false, onChange]
}

/**
 * The global beta switch.
 *
 * `pending` holds the in-flight value and is cleared in `finally`, so a failed
 * write snaps the switch back to what is actually stored rather than leaving it
 * displaying a value that never persisted. Same shape as the preview-feature
 * switches in `FeatureSettings`, deliberately: a toggle is the one control where
 * showing an unsaved value reads as saved.
 */
export function BetaSwitch() {
  const [beta, setBeta] = useBeta()
  const { push: notify } = Notifications.use()
  const [pending, setPending] = React.useState<boolean | null>(null)
  const handleChange = React.useCallback(
    async (_event: React.ChangeEvent<{}>, checked: boolean) => {
      if (pending !== null) return
      setPending(checked)
      try {
        await setBeta(checked)
      } catch (e) {
        Sentry.captureException(e)
        notify(
          e instanceof CatalogSettings.SettingsConflictError
            ? e.message
            : "Couldn't save settings, see console for details",
        )
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setPending(null)
      }
    },
    [notify, pending, setBeta],
  )
  return (
    <M.Switch
      checked={pending ?? beta}
      onChange={handleChange}
      disabled={pending !== null}
    />
  )
}

const useNavLinkEditorStyles = M.makeStyles((t) => ({
  actions: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(1),
  },
  field: {
    display: 'flex',
  },
  fieldName: {
    ...t.typography.body2,
    flexShrink: 0,
    fontWeight: t.typography.fontWeightMedium,
    width: 50,
  },
  fieldValue: {
    ...t.typography.body2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progress: {
    marginLeft: t.spacing(1),
  },
  notConfigured: {
    ...t.typography.body1,
    marginRight: t.spacing(2),
  },
}))

function NavLinkEditor() {
  const settings = CatalogSettings.use()
  const writeSettings = CatalogSettings.useWriteSettings()

  const { push } = Notifications.use()

  const classes = useNavLinkEditorStyles()

  const [editing, setEditing] = React.useState(false)
  const [formKey, setFormKey] = React.useState(1)
  const [removing, setRemoving] = React.useState(false)

  const edit = React.useCallback(() => {
    if (removing) return
    setEditing(true)
  }, [removing])

  const cancel = React.useCallback(() => {
    setEditing(false)
  }, [])

  const handleExited = React.useCallback(() => {
    // reset the form
    setFormKey(R.inc)
  }, [])

  const remove = React.useCallback(async () => {
    if (editing || removing || !settings?.customNavLink) return
    // XXX: implement custom MUI Dialog-based confirm?
    // eslint-disable-next-line no-restricted-globals, no-alert
    if (!window.confirm('You are about to remove custom link')) return
    setRemoving(true)
    try {
      await writeSettings(R.dissoc('customNavLink', settings), settings)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Error saving settings:')
      // eslint-disable-next-line no-console
      console.error(e)
      push(
        e instanceof CatalogSettings.SettingsConflictError
          ? e.message
          : "Couldn't save settings, see console for details",
      )
    } finally {
      setRemoving(false)
    }
  }, [editing, removing, settings, writeSettings, push])

  const onSubmit = React.useCallback(
    async (values: { url: string; label: string }) => {
      try {
        await writeSettings(
          {
            ...settings,
            customNavLink: { url: values.url, label: values.label },
          },
          settings,
        )
        setEditing(false)
        return undefined
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Error saving settings:')
        // eslint-disable-next-line no-console
        console.error(e)
        return {
          [FF.FORM_ERROR]:
            e instanceof CatalogSettings.SettingsConflictError
              ? e.message
              : "Couldn't save settings, see console for details",
        }
      }
    },
    [settings, writeSettings],
  )

  return (
    <>
      {settings?.customNavLink ? (
        <>
          <div className={classes.field}>
            <div className={classes.fieldName}>URL:</div>
            <div className={classes.fieldValue}>{settings.customNavLink.url}</div>
          </div>
          <div className={classes.field}>
            <div className={classes.fieldName}>Label:</div>
            <div className={classes.fieldValue}>{settings.customNavLink.label}</div>
          </div>
          <div className={classes.actions}>
            <M.Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={edit}
              disabled={removing}
            >
              Edit
            </M.Button>
            <M.Box pl={1} />
            <M.Button color="primary" size="small" onClick={remove} disabled={removing}>
              Remove
            </M.Button>
            {removing && <M.CircularProgress size={24} className={classes.progress} />}
          </div>
        </>
      ) : (
        <>
          <div className={classes.notConfigured}>Not configured</div>
          <div className={classes.actions}>
            <M.Button variant="outlined" color="primary" size="small" onClick={edit}>
              Configure link
            </M.Button>
          </div>
        </>
      )}
      <M.Dialog open={editing} onExited={handleExited} fullWidth>
        <RF.Form onSubmit={onSubmit} key={formKey}>
          {({
            handleSubmit,
            submitting,
            submitFailed,
            submitError,
            error,
            hasValidationErrors,
          }) => (
            <>
              <M.DialogTitle>Configure custom link</M.DialogTitle>
              <M.DialogContent>
                <form onSubmit={handleSubmit}>
                  <RF.Field
                    component={Form.Field}
                    initialValue={settings?.customNavLink?.url || ''}
                    name="url"
                    label="URL"
                    placeholder="e.g. https://example.com/path"
                    validate={validators.required as FF.FieldValidator<string>}
                    errors={{
                      required: 'Enter URL to link to',
                    }}
                    disabled={submitting}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <M.Box pt={2} />
                  <RF.Field
                    component={Form.Field}
                    initialValue={settings?.customNavLink?.label || ''}
                    name="label"
                    label="Label"
                    placeholder="Enter link label"
                    validate={validators.required as FF.FieldValidator<string>}
                    errors={{
                      required: 'Enter link label',
                    }}
                    disabled={submitting}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <input type="submit" style={{ display: 'none' }} />
                </form>
              </M.DialogContent>
              <M.DialogActions>
                {submitting ? (
                  <SubmitSpinner />
                ) : (
                  (!!error || !!submitError) && (
                    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
                      <M.Icon color="error">error_outline</M.Icon>
                      <M.Box pl={1} />
                      <M.Typography variant="body2" color="error">
                        {error || submitError}
                      </M.Typography>
                    </M.Box>
                  )
                )}

                <M.Button onClick={cancel} disabled={submitting}>
                  Cancel
                </M.Button>
                <M.Button
                  type="submit"
                  onClick={handleSubmit}
                  variant="contained"
                  color="primary"
                  disabled={submitting || (submitFailed && hasValidationErrors)}
                >
                  Save
                </M.Button>
              </M.DialogActions>
            </>
          )}
        </RF.Form>
      </M.Dialog>
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gap: t.spacing(3),
    padding: t.spacing(2, 0, 4),
    [t.breakpoints.up('md')]: {
      alignItems: 'start',
      gridTemplateColumns: `${t.spacing(24)}px minmax(0, 1fr)`,
    },
  },
  // Sticky rather than scroll-spying: the index is for jumping, and a
  // highlight that tracks the scroll position is state to keep correct for
  // nothing the reader asked for.
  nav: {
    display: 'none',
    [t.breakpoints.up('md')]: {
      display: 'block',
      position: 'sticky',
      // Clears the 64px app bar the page scrolls under.
      top: t.spacing(10),
    },
  },
  navGroup: {
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
  navGroupName: {
    ...t.typography.overline,
    color: t.palette.text.hint,
    display: 'block',
    marginBottom: t.spacing(0.5),
  },
  navLink: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    display: 'block',
    padding: t.spacing(0.5, 0),
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  sections: {
    display: 'grid',
    gap: t.spacing(2),
  },
  groupHeading: {
    ...t.typography.overline,
    color: t.palette.text.hint,
    '$sections > * + &': {
      marginTop: t.spacing(2),
    },
  },
}))

const useSectionStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
    // The jump links above land the section below the app bar, not under it.
    scrollMarginTop: t.spacing(10),
  },
  heading: {
    marginBottom: t.spacing(0.5),
  },
  hint: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    display: 'block',
    marginBottom: t.spacing(2),
  },
}))

interface SectionProps {
  id: string
  title: string
  hint: string
  children: React.ReactNode
}

function SectionFallback({ error }: FallbackProps) {
  return (
    <M.Typography variant="body2" color="error">
      Could not load this setting: {error.message}
    </M.Typography>
  )
}

// Every section says what it controls. Several read as bare labels otherwise
// -- "Navigation link" never says where the link goes or who sees it.
function Section({ id, title, hint, children }: SectionProps) {
  const classes = useSectionStyles()
  return (
    <M.Paper id={id} className={classes.root} variant="outlined">
      <M.Typography variant="h6" className={classes.heading}>
        {title}
      </M.Typography>
      <span className={classes.hint}>{hint}</span>
      {/* The boundary is the section's own: without it a failed read here escapes to
          the admin-wide boundary and replaces every other section too, which defeats
          the point of suspending per section. */}
      <ErrorBoundary FallbackComponent={SectionFallback}>
        <React.Suspense fallback={<M.CircularProgress size={24} />}>
          {children}
        </React.Suspense>
      </ErrorBoundary>
    </M.Paper>
  )
}

// Gated on the `data-products` preview feature, matching how `FeatureSettings` is
// gated: with the capability off, an admin offered a catalog-connection form
// would be configuring something no reader can reach.
//
// Its own component because `useFeature` suspends and `Settings` does not,
// so the read has to sit under a boundary of its own. Same reason the nav entry
// for it below is a component rather than a row in the index.
export function DataProductCatalogs() {
  const enabled = useFeature('data-products')
  if (!enabled) return null
  return (
    <Section
      id="data-products"
      title="Data product catalogs"
      hint="External catalogs this stack publishes its data products to."
    >
      <DataProductConnections />
    </Section>
  )
}

const GROUPS: { name: string; items: { id: string; title: string }[] }[] = [
  {
    name: 'Appearance',
    items: [
      { id: 'theme', title: 'Theme' },
      { id: 'nav-link', title: 'Navigation link' },
    ],
  },
  {
    name: 'Search and assistant',
    items: [
      { id: 'search', title: 'Default search mode' },
      { id: 'qurator', title: 'Qurator instructions' },
    ],
  },
  {
    name: 'Data',
    items: [
      { id: 'tabulator', title: 'Tabulator' },
      { id: 'packager', title: 'Packaging engine' },
    ],
  },
  {
    name: 'Platform',
    items: [
      { id: 'beta', title: 'Beta features' },
      ...(HAS_PREVIEW_FEATURES ? [{ id: 'preview', title: 'Preview features' }] : []),
      { id: 'diagnostics', title: 'Support diagnostics' },
    ],
  },
]

function DataProductNavLink({ className }: { className: string }) {
  const enabled = useFeature('data-products')
  if (!enabled) return null
  return (
    <a href="#data-products" className={className}>
      Data product catalogs
    </a>
  )
}

function Nav() {
  const classes = useStyles()
  return (
    <nav className={classes.nav}>
      {GROUPS.map(({ name, items }) => (
        <div className={classes.navGroup} key={name}>
          <span className={classes.navGroupName}>{name}</span>
          {items.map(({ id, title }) => (
            <a href={`#${id}`} className={classes.navLink} key={id}>
              {title}
            </a>
          ))}
          {name === 'Data' && (
            <React.Suspense fallback={null}>
              <DataProductNavLink className={classes.navLink} />
            </React.Suspense>
          )}
        </div>
      ))}
    </nav>
  )
}

export default function Settings() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <MetaTitle>{['Settings', 'Admin']}</MetaTitle>
      <Nav />
      <div className={classes.sections}>
        <M.Typography className={classes.groupHeading}>Appearance</M.Typography>
        <Section
          id="theme"
          title="Theme"
          hint="The logo and accent color every page of this catalog carries."
        >
          <ThemeEditor />
        </Section>
        <Section
          id="nav-link"
          title="Navigation link"
          hint="An extra link in the catalog's top navigation bar, shown to everyone on this stack."
        >
          <NavLinkEditor />
        </Section>

        <M.Typography className={classes.groupHeading}>Search and assistant</M.Typography>
        <Section
          id="search"
          title="Default search mode"
          hint="What a search covers before anyone narrows it."
        >
          <SearchSettings />
        </Section>
        <Section
          id="qurator"
          title="Qurator instructions"
          hint="Standing instructions sent with every Qurator message on this stack."
        >
          <QuratorSettings />
        </Section>

        <M.Typography className={classes.groupHeading}>Data</M.Typography>
        <Section
          id="tabulator"
          title="Tabulator"
          hint="Tables that stitch package files into one queryable surface."
        >
          <TabulatorSettings />
        </Section>
        <Section
          id="packager"
          title="Packaging engine"
          hint="How this stack builds packages from incoming data."
        >
          <PackagerSettings />
        </Section>
        <React.Suspense fallback={null}>
          <DataProductCatalogs />
        </React.Suspense>

        <M.Typography className={classes.groupHeading}>Platform</M.Typography>
        <Section
          id="beta"
          title="Beta features"
          hint="Opens features still under development to everyone on this stack."
        >
          <M.FormControlLabel control={<BetaSwitch />} label="Beta features on" />
        </Section>
        {/* Absent entirely when this build declares no preview capabilities,
            rather than rendering an empty section. */}
        {HAS_PREVIEW_FEATURES && (
          <Section
            id="preview"
            title="Preview features"
            hint="Individual capabilities this build can offer ahead of general release."
          >
            <FeatureSettings />
          </Section>
        )}
        <Section
          id="diagnostics"
          title="Support diagnostics"
          hint="A bundle of stack state to attach to a support request."
        >
          <SupportDiagnostics />
        </Section>
      </div>
    </div>
  )
}
