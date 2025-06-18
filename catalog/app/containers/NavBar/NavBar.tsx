import cx from 'classnames'
import * as React from 'react'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as BucketConfig from 'utils/BucketConfig'
import * as NamedRoutes from 'utils/NamedRoutes'

import bg from './bg.png'

import * as Controls from './Controls'
import * as NavMenu from './NavMenu'
import { useNavBar } from './Provider'
import * as Subscription from './Subscription'

const useLogoLinkStyles = M.makeStyles((t) => ({
  root: {
    position: 'absolute',
    minHeight: t.spacing(6),
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
  },
}))

function LogoLink() {
  const settings = CatalogSettings.use()
  const classes = useLogoLinkStyles()
  const { urls } = NamedRoutes.use()
  return (
    <Link to={urls.home()} className={classes.root}>
      <Logo width="64px" height="24px" src={settings?.logo?.url} />
    </Link>
  )
}

interface QuiltLinkProps {
  className?: string
}

function QuiltLink({ className }: QuiltLinkProps) {
  return (
    <a
      className={className}
      href={URLS.homeMarketing}
      target="_blank"
      title="Where data comes together"
    >
      <Logo width="27px" height="27px" />
    </a>
  )
}

const useAppBarStyles = M.makeStyles((t) => ({
  root: ({ backgroundColor }: { backgroundColor?: string }) => ({
    zIndex: t.zIndex.appBar + 1,
    background: backgroundColor || `${t.palette.secondary.dark} left / 48px url(${bg})`,
    color: backgroundColor
      ? t.palette.getContrastText(backgroundColor)
      : t.palette.primary.contrastText,
  }),
}))

interface AppBarProps {
  children: React.ReactNode
}

const AppBar = React.forwardRef<HTMLDivElement, AppBarProps>(function AppBar(
  { children },
  ref,
) {
  const settings = CatalogSettings.use()
  const classes = useAppBarStyles({
    backgroundColor: settings?.theme?.palette?.primary?.main,
  })
  return (
    <M.AppBar className={classes.root} ref={ref}>
      {children}
    </M.AppBar>
  )
})

const useHeaderStyles = M.makeStyles((t) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
  },
  main: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
  },
  fullWidth: {
    animation: t.transitions.create('$expand'),
  },
  '@keyframes expand': {
    '0%': {
      transform: 'scaleX(0.94)',
    },
    '100%': {
      transform: 'scaleX(1)',
    },
  },
}))

interface HeaderProps {
  children?: React.ReactNode
}

export function Header({ children }: HeaderProps) {
  const trigger = M.useScrollTrigger()
  const settings = CatalogSettings.use()
  const classes = useHeaderStyles({
    customBg: !!settings?.theme?.palette?.primary?.main,
  })
  const { fullWidth } = useNavBar() || {}
  return (
    <M.Box>
      <M.Toolbar variant="dense" />
      <M.Slide appear={false} direction="down" in={!trigger}>
        <AppBar>
          <M.Toolbar disableGutters variant="dense">
            <M.Container
              className={cx(classes.container, fullWidth && classes.fullWidth)}
              maxWidth={fullWidth ? false : 'lg'}
            >
              <div className={classes.main}>{children}</div>
            </M.Container>
          </M.Toolbar>
        </AppBar>
      </M.Slide>
    </M.Box>
  )
}

interface ContainerProps {
  children?: React.ReactNode
}

export function Container({ children }: ContainerProps) {
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <Header>{children}</Header>
    </M.MuiThemeProvider>
  )
}

const useLicenseErrorStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.error.light,
  },
}))

interface LicenseErrorProps {
  restore: () => void
}

function LicenseError({ restore }: LicenseErrorProps) {
  const classes = useLicenseErrorStyles()
  return (
    <M.Tooltip title="This Quilt stack is unlicensed. Contact your Quilt administrator.">
      <M.IconButton className={classes.root} onClick={restore}>
        <M.Icon>error_outline</M.Icon>
      </M.IconButton>
    </M.Tooltip>
  )
}

interface BucketControlProps {
  bucket: string
}

function BucketControl({ bucket }: BucketControlProps) {
  const [selectBucket, setSelectBucket] = React.useState(false)
  const select = React.useCallback(() => setSelectBucket(true), [])
  const cancel = React.useCallback(() => setSelectBucket(false), [])

  const selectRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    if (selectRef.current) selectRef.current.focus()
  }, [selectBucket])

  if (selectBucket) {
    return (
      <Controls.BucketSelect
        // @ts-expect-error
        cancel={cancel}
        ref={selectRef}
        fullWidth
      />
    )
  }
  return <Controls.BucketDisplay bucket={bucket} select={select} />
}

const useNavBarStyles = M.makeStyles((t) => ({
  quiltLogo: {
    background: `${t.palette.secondary.dark} left / 48px url(${bg})`,
    padding: t.spacing(1),
    borderRadius: '50% 50% 0 50%',
  },
  search: {
    marginRight: t.spacing(4),
    [t.breakpoints.down('sm')]: {
      marginRight: t.spacing(1),
    },
  },
  burger: {
    alignItems: 'center',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gridColumnGap: t.spacing(1),
    marginRight: 'auto',
    // half of the viewport minus half of the logo and minus padding
    width: `calc(50% - ${64 / 2}px - ${t.spacing(4)}px)`,
  },
  user: {
    display: 'flex',
    alignItems: 'center',
  },
}))

export function NavBar() {
  const classes = useNavBarStyles()

  const settings = CatalogSettings.use()
  const sub = Subscription.useState()
  const authenticated = redux.useSelector(authSelectors.authenticated)

  const hideControls = cfg.alwaysRequiresAuth && !authenticated

  const bucket = BucketConfig.useCurrentBucket()

  return (
    <Container>
      <div className={classes.burger}>
        <NavMenu.Links />

        <Subscription.Display {...sub} />
        {sub.invalid && <LicenseError restore={sub.restore} />}

        {bucket && <BucketControl bucket={bucket} />}
      </div>

      <LogoLink />

      <div className={classes.user}>
        {!hideControls && (
          <Link className={classes.search} to="/search">
            <Buttons.Iconized
              icon="search"
              label="Search"
              variant="text"
              color="inherit"
            />
          </Link>
        )}

        <NavMenu.Menu />

        {settings?.logo?.url && <QuiltLink className={classes.quiltLogo} />}
      </div>
    </Container>
  )
}
