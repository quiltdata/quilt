import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'
import * as I from '@material-ui/icons'

import Skeleton from 'components/Skeleton'
import * as AuthSelectors from 'containers/Auth/selectors'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import StyledTooltip from 'utils/StyledTooltip'
import { formatQuantity, readableBytes } from 'utils/string'

import BucketSelect from 'containers/NavBar/BucketSelect'
import { BucketDisplay } from 'containers/NavBar/Controls'
import { Popup } from 'components/Collaborators'

import COLLABORATORS_QUERY from './gql/Collaborators.generated'
import BUCKET_OVERVIEW_URL_QUERY from './gql/BucketOverviewUrl.generated'

import * as requests from './requests'

interface ChipLinkProps {
  className: string
  label: React.ReactNode
  to: string
  icon: string | React.ReactNode
  title: string
}

function ChipLink({ className, icon, label, to }: ChipLinkProps) {
  return (
    <StyledTooltip title="Total size">
      <M.Button
        className={className}
        component={Link}
        size="small"
        startIcon={
          typeof icon === 'string' ? <M.Icon fontSize="small">{icon}</M.Icon> : icon
        }
        to={to}
      >
        {label}
      </M.Button>
    </StyledTooltip>
  )
}

interface ChipLoadingProps {
  className: string
}

function ChipLoading({ className }: ChipLoadingProps) {
  return (
    <M.Button
      className={className}
      size="small"
      startIcon={<M.CircularProgress size={16} />}
    >
      ?
    </M.Button>
  )
}

interface ChipErrorProps {
  className: string
  error: Error
}

function ChipError({ className, error }: ChipErrorProps) {
  return (
    <StyledTooltip title={error.message}>
      <M.Button
        className={className}
        size="small"
        startIcon={<M.Icon>error_outline</M.Icon>}
      >
        ?
      </M.Button>
    </StyledTooltip>
  )
}

function PackagesIcon() {
  return (
    <M.SvgIcon
      fontSize="small"
      height="32"
      style={{ width: '16px', height: '16px' }}
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6,2 L26,2 L32,13 L0,13 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />

      <line x1="16" y1="2" x2="16" y2="13" stroke="currentColor" strokeWidth="3" />
      <path
        d="M0,13 H32 V28 A3,3 0 0 1 29,31 H3 A3,3 0 0 1 0,28 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </M.SvgIcon>
  )
}

function NoCollaborators({ className }: { className: string }) {
  return (
    <StyledTooltip title="Only you can see this bucket">
      <M.IconButton className={className} size="small">
        <I.VisibilityOffOutlined fontSize="small" />
      </M.IconButton>
    </StyledTooltip>
  )
}

const NO_COLLABORATORS: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> = []

function useCollaborators(bucket: string) {
  const result = GQL.useQuery(COLLABORATORS_QUERY, {
    bucket,
  })
  return GQL.fold(result, {
    data: ({ bucketConfig, potentialCollaborators }) => {
      const collaborators = bucketConfig?.collaborators || NO_COLLABORATORS
      return AsyncResult.Ok([
        ...(collaborators || []),
        ...potentialCollaborators.map((collaborator) => ({
          collaborator,
          permissionLevel: undefined,
        })),
      ])
    },
    fetching: () => AsyncResult.Pending(),
    error: (error) => AsyncResult.Err(error),
  })
}

interface CollaboratorsNumberProps {
  bucket: string
  className: string
  collaborators: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection>
}

function Collaborators({ bucket, className, collaborators }: CollaboratorsNumberProps) {
  const hasUnmanagedRole = React.useMemo(
    () => collaborators.find(({ permissionLevel }) => !permissionLevel),
    [collaborators],
  )

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  return (
    <>
      <StyledTooltip title="Number of collaborators">
        <M.Button
          className={className}
          onClick={handleOpen}
          size="small"
          startIcon={<I.VisibilityOutlined fontSize="small" />}
        >
          {hasUnmanagedRole ? `${collaborators.length}+` : `${collaborators.length}`}
        </M.Button>
      </StyledTooltip>
      <Popup
        bucket={bucket}
        collaborators={collaborators}
        onClose={handleClose}
        open={open}
      />
    </>
  )
}

function useBucketStats(bucket: string) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const { bucketConfig } = GQL.useQueryS(BUCKET_OVERVIEW_URL_QUERY, { bucket })
  const overviewUrl = bucketConfig?.overviewUrl
  return useData(requests.bucketStats, { req, s3, bucket, overviewUrl })
}

function usePackagesStats(bucket: string) {
  const req = APIConnector.use()
  return useData(requests.countPackageRevisions, { req, bucket })
}

const useStatsStyles = M.makeStyles((t) => ({
  chip: {
    color: t.palette.text.secondary,
    marginLeft: t.spacing(1),
    minWidth: 'auto',
  },
}))

interface StatsProps {
  className: string
  bucket: string
}

function Stats({ className, bucket }: StatsProps) {
  const classes = useStatsStyles()
  const { urls } = NamedRoutes.use()

  const { result: stats } = useBucketStats(bucket)
  const { result: pkgs } = usePackagesStats(bucket)
  const collaborators = useCollaborators(bucket)

  const chipNoData = AsyncResult.mapCase({
    Err: (error: Error) => <ChipError className={classes.chip} error={error} />,
    Pending: () => <ChipLoading className={classes.chip} />,
  })

  return (
    <div className={className}>
      {AsyncResult.case(
        {
          Ok: ({ totalBytes }: { totalBytes: number }) => (
            <ChipLink
              className={classes.chip}
              icon="pie_chart_outlined"
              label={readableBytes(totalBytes)}
              title="Total size"
              to={urls.bucketOverview(bucket)}
            />
          ),
          _: () => null,
        },
        chipNoData(stats),
      )}

      {AsyncResult.case(
        {
          Ok: ({ totalObjects }: { totalObjects: number }) => (
            <ChipLink
              className={classes.chip}
              icon={<I.InsertDriveFileOutlined fontSize="small" />}
              label={readableBytes(totalObjects)}
              title="Number of objects in the bucket"
              to={urls.bucketDir(bucket)}
            />
          ),
          _: () => null,
        },
        chipNoData(stats),
      )}

      {AsyncResult.case(
        {
          Ok: (data: number) => (
            <ChipLink
              className={classes.chip}
              icon={<PackagesIcon />}
              label={formatQuantity(data)}
              title="Number of packages in the bucket"
              to={urls.bucketPackageList(bucket)}
            />
          ),
          _: () => null,
        },
        chipNoData(pkgs),
      )}

      {AsyncResult.case(
        {
          Ok: (data: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection>) =>
            data.length ? (
              <Collaborators
                bucket={bucket}
                className={classes.chip}
                collaborators={data}
              />
            ) : (
              <NoCollaborators className={classes.chip} />
            ),
          _: () => null,
        },
        chipNoData(collaborators),
      )}
    </div>
  )
}

const useTabStyles = M.makeStyles((t) => ({
  root: {
    minHeight: t.spacing(8),
    minWidth: 120,
  },
}))

type NavTabProps = React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>

function NavTab(props: NavTabProps) {
  const classes = useTabStyles()
  return <M.Tab className={classes.root} component={Link} {...props} />
}

interface TabsProps {
  className: string
  bucket: string
  preferences: BucketPreferences.NavPreferences
  section: string | boolean
}

const ANCHOR_ORIGIN = { vertical: 'bottom' as const, horizontal: 'right' as const }
const TRANSFORM_ORIGIN = { vertical: 'top' as const, horizontal: 'right' as const }

function Tabs({ className, bucket, preferences, section = false }: TabsProps) {
  const { urls } = NamedRoutes.use()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  return (
    <div className={className}>
      <M.Tabs
        value={section}
        variant={sm ? 'scrollable' : 'standard'}
        scrollButtons="auto"
      >
        <NavTab label="Overview" value="overview" to={urls.bucketOverview(bucket)} />
        {preferences.files && (
          <NavTab label="Bucket" value="tree" to={urls.bucketDir(bucket)} />
        )}
        {preferences.packages && (
          <NavTab label="Packages" value="packages" to={urls.bucketPackageList(bucket)} />
        )}
      </M.Tabs>
      <M.IconButton
        style={{ marginLeft: '8px', alignSelf: 'center' }}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        edge="end"
      >
        <M.Icon>more_vert</M.Icon>
      </M.IconButton>
      <M.Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={ANCHOR_ORIGIN}
        transformOrigin={TRANSFORM_ORIGIN}
      >
        {preferences.workflows && (
          <M.MenuItem component={Link} to={urls.bucketWorkflowList(bucket)}>
            Workflows
          </M.MenuItem>
        )}
        {preferences.queries && authenticated && (
          <M.MenuItem component={Link} to={urls.bucketQueries(bucket)}>
            Athena Queries
          </M.MenuItem>
        )}
        {preferences.queries && (
          <M.MenuItem component={Link} to={urls.bucketESQueries(bucket)}>
            ElasticSearch
          </M.MenuItem>
        )}
      </M.Menu>
    </div>
  )
}

const useControlPanelStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    [t.breakpoints.down('sm')]: {
      paddingTop: t.spacing(2),
    },
  },
  stats: {
    marginLeft: t.spacing(4),
    [t.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
}))

interface ControlPanelProps {
  className: string
  bucket: string
}

function ControlPanel({ bucket, className }: ControlPanelProps) {
  const classes = useControlPanelStyles()
  const [selectBucket, setSelectBucket] = React.useState(false)
  const select = React.useCallback(() => setSelectBucket(true), [])
  const cancel = React.useCallback(() => setSelectBucket(false), [])

  const selectRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    if (selectRef.current) selectRef.current.focus()
  }, [selectBucket])
  return (
    <div className={cx(classes.root, className)}>
      {selectBucket ? (
        // @ts-expect-error
        <BucketSelect cancel={cancel} ref={selectRef} fullWidth />
      ) : (
        <BucketDisplay bucket={bucket} select={select} />
      )}

      {!selectBucket && <Stats className={classes.stats} bucket={bucket} />}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
  controlPanel: {
    flexGrow: 1,
    maxWidth: t.spacing(85),
    [t.breakpoints.down('sm')]: {
      width: '100%',
      justifyContent: 'center',
    },
  },
  nav: {
    display: 'flex',
    [t.breakpoints.up('sm')]: {
      marginLeft: 'auto',
    },
  },
  skeleton: {
    height: t.spacing(2),
    margin: t.spacing(0, 2),
  },
  toolbar: {
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
}))

interface BucketNavProps {
  bucket: string
  section: 'es' | 'overview' | 'packages' | 'queries' | 'tree' | 'workflows' | false // `keyof` sections object
}

export default function BucketNav({ bucket, section = false }: BucketNavProps) {
  const classes = useStyles()
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { nav } }) => (
        <M.AppBar position="static" className={classes.root}>
          <M.Container maxWidth="lg">
            <M.Toolbar disableGutters className={classes.toolbar}>
              <ControlPanel bucket={bucket} className={classes.controlPanel} />
              <Tabs
                bucket={bucket}
                className={classes.nav}
                preferences={nav}
                section={section}
              />
            </M.Toolbar>
          </M.Container>
        </M.AppBar>
      ),
      Pending: () => <Skeleton className={classes.skeleton} animate />,
      Init: () => null,
    },
    prefs,
  )
}
