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
import * as NamedRoutes from 'utils/NamedRoutes'

import bg from './bg.png'

import * as NavMenu from './NavMenu'
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

const useHeaderStyles = M.makeStyles({
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
})

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
      <M.Toolbar variant="dense" />
      <M.Slide appear={false} direction="down" in={!trigger}>
        <AppBar>
          <M.Toolbar disableGutters variant="dense">
            <M.Container className={classes.container} maxWidth="lg">
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
    display: 'grid',
    marginRight: 'auto',
    gridTemplateColumns: 'auto auto',
    gridColumnGap: t.spacing(1),
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

  return (
    <Container>
      <div className={classes.burger}>
        <NavMenu.Links />

        <Subscription.Display {...sub} />
        {sub.invalid && <LicenseError restore={sub.restore} />}
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
