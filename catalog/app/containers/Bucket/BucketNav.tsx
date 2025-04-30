import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'
import * as I from '@material-ui/icons'

import Skeleton from 'components/Skeleton'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import StyledTooltip from 'utils/StyledTooltip'

import BucketSelect from 'containers/NavBar/BucketSelect'
import { BucketDisplay } from 'containers/NavBar/Controls'
import { Popup } from 'components/Collaborators'

interface ChipProps {
  bucket: string
  className: string
  label: React.ReactNode
}

function TotalSize({ bucket, className, label }: ChipProps) {
  const { urls } = NamedRoutes.use()
  return (
    <StyledTooltip title="Total size">
      <M.Chip
        className={className}
        clickable
        component={Link}
        icon={<M.Icon fontSize="small">pie_chart_outlined</M.Icon>}
        label={label}
        to={urls.bucketOverview(bucket)}
        variant="outlined"
      />
    </StyledTooltip>
  )
}

function ObjectsNumber({ bucket, className, label }: ChipProps) {
  const { urls } = NamedRoutes.use()
  return (
    <StyledTooltip title="Number of objects in the bucket">
      <M.Chip
        className={className}
        clickable
        component={Link}
        icon={<I.InsertDriveFileOutlined fontSize="small" />}
        label={label}
        to={urls.bucketDir(bucket)}
        variant="outlined"
      />
    </StyledTooltip>
  )
}

function PackagesNumber({ bucket, className, label }: ChipProps) {
  const { urls } = NamedRoutes.use()
  return (
    <StyledTooltip title="Number of packages in the bucket">
      <M.Chip
        className={className}
        clickable
        component={Link}
        icon={
          <M.SvgIcon
            width="32"
            height="32"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '16px', height: '16px' }}
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
        }
        label={label}
        to={urls.bucketPackageList(bucket)}
        variant="outlined"
      />
    </StyledTooltip>
  )
}

function CollaboratorsNumber({ bucket, className, label }: ChipProps) {
  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])
  return (
    <>
      <StyledTooltip title="Number of collaborators">
        <M.Chip
          className={className}
          icon={<I.VisibilityOutlined fontSize="small" />}
          label={label}
          onClick={handleOpen}
          variant="outlined"
        />
      </StyledTooltip>
      <Popup bucket={bucket} collaborators={[]} onClose={handleClose} open={open} />
    </>
  )
}

const useStatsStyles = M.makeStyles((t) => ({
  chip: {
    marginLeft: t.spacing(1),
    paddingLeft: t.spacing(0.5),
  },
}))

interface StatsProps {
  className: string
  bucket: string
}

function Stats({ className, bucket }: StatsProps) {
  const classes = useStatsStyles()
  return (
    <div className={className}>
      <TotalSize bucket={bucket} className={classes.chip} label="49.7 GB" />
      <ObjectsNumber bucket={bucket} className={classes.chip} label="31.5 k" />
      <PackagesNumber bucket={bucket} className={classes.chip} label="862" />
      <CollaboratorsNumber bucket={bucket} className={classes.chip} label="18+" />
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
