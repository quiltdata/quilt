import * as React from 'react'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import LayoutContainer from 'components/Layout/Container'
import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as authSelectors from 'containers/Auth/selectors'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'

import bg from './bg.png'

import Controls from './Controls'
import * as NavMenu from './NavMenu'
import * as Subscription from './Subscription'

const useLogoLinkStyles = M.makeStyles((t) => ({
  bgQuilt: {
    background: `${t.palette.secondary.dark} left / 64px url(${bg})`,
  },
  bgCustom: {
    alignItems: 'center',
    // TODO: make UI component with this background, and DRY
    background: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor || `${t.palette.secondary.dark} left / 64px url(${bg})`,
    borderRadius: t.spacing(0, 0, 2, 0),
    display: 'flex',
    justifyContent: 'center',
    minHeight: t.spacing(8),
    paddingRight: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor ? t.spacing(4) : t.spacing(2),
  },
}))

function LogoLink() {
  const settings = CatalogSettings.use()
  const classes = useLogoLinkStyles({
    backgroundColor: settings?.theme?.palette?.primary?.main,
  })
  const { urls } = NamedRoutes.use()
  return (
    <div className={classes.bgQuilt}>
      <div className={classes.bgCustom}>
        <Link to={urls.home()}>
          <Logo width="27px" height="27px" src={settings?.logo?.url} />
        </Link>
      </div>
    </div>
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
  root: {
    zIndex: t.zIndex.appBar + 1,
  },
  bgWrapper: {
    bottom: 0,
    display: 'flex',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bgCustom: {
    background: ({ backgroundColor }: { backgroundColor?: string }) =>
      backgroundColor || `${t.palette.secondary.dark} left / 64px url(${bg})`,
    flex: '50%',
  },
  bgQuilt: {
    background: `${t.palette.secondary.dark} left / 64px url(${bg})`,
    flex: '50%',
  },
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
      <div className={classes.bgWrapper}>
        <div className={classes.bgCustom} />
        <div className={classes.bgQuilt} />
      </div>
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
    background: `${t.palette.secondary.dark} left / 64px url(${bg})`,
    borderRadius: '16px 0 0 0',
    display: 'flex',
    flexGrow: 1,
    minHeight: '64px',
    paddingLeft: ({ customBg }: { customBg: boolean }) => (customBg ? '32px' : undefined),
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
  return (
    <M.Box>
      <M.Toolbar />
      <M.Slide appear={false} direction="down" in={!trigger}>
        <AppBar>
          <M.Toolbar disableGutters>
            <LayoutContainer className={classes.container}>
              <LogoLink />
              <div className={classes.main}>{children}</div>
            </LayoutContainer>
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
  licenseError: {
    color: t.palette.error.light,
    marginRight: t.spacing(0.5),

    [t.breakpoints.down('sm')]: {
      marginLeft: t.spacing(1.5),
      marginRight: 0,
    },
  },
}))

interface LicenseErrorProps {
  restore: () => void
}

function LicenseError({ restore }: LicenseErrorProps) {
  const classes = useLicenseErrorStyles()
  return (
    <M.Tooltip title="This Quilt stack is unlicensed. Contact your Quilt administrator.">
      <M.IconButton className={classes.licenseError} onClick={restore} size="small">
        <M.Icon>error_outline</M.Icon>
      </M.IconButton>
    </M.Tooltip>
  )
}

const useNavBarStyles = M.makeStyles({
  quiltLogo: {
    margin: '0 0 3px 8px',
  },
  spacer: {
    flexGrow: 1,
  },
})

export function NavBar() {
  const classes = useNavBarStyles()
  const t = M.useTheme()
  const collapse = M.useMediaQuery(t.breakpoints.down('sm'))

  const settings = CatalogSettings.use()
  const sub = Subscription.useState()
  const authenticated = redux.useSelector(authSelectors.authenticated)

  const hideControls = cfg.alwaysRequiresAuth && !authenticated

  return (
    <Container>
      {hideControls ? <div className={classes.spacer} /> : <Controls />}

      <Subscription.Display {...sub} />

      {!collapse && <NavMenu.Links />}

      {sub.invalid && <LicenseError restore={sub.restore} />}

      <NavMenu.Menu collapse={collapse} />

      {settings?.logo?.url && <QuiltLink className={classes.quiltLogo} />}
    </Container>
  )
}
