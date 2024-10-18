import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import Logo from 'components/Logo'
import Skeleton from 'components/Skeleton'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import STACK_QUERY from 'utils/Stack.generated'

import bg from './bg.png'
import iconFacebook from './icon-facebook.svg'
import iconGithub from './icon-github.svg'
import iconInstagram from './icon-instagram.svg'
import iconLinkedin from './icon-linkedin.svg'
import iconSlack from './icon-slack.svg'
import iconTwitter from './icon-twitter.svg'

const useVersionStyles = M.makeStyles((t) => ({
  revision: {
    color: t.palette.secondary.main,
    cursor: 'pointer',
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
}))

function Version() {
  const { stack } = GQL.useQueryS(STACK_QUERY)
  const classes = useVersionStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(stack.version || '')
    push('Web catalog container hash has been copied to clipboard')
  }, [push, stack.version])
  return (
    <M.Typography
      className={classes.revision}
      onClick={handleCopy}
      title="Copy product revision hash to clipboard"
      variant="caption"
    >
      Version: {stack.version}
    </M.Typography>
  )
}

const FooterLogo = () => <Logo height="29px" width="76.5px" />

const NavLink = (props: M.LinkProps) => (
  <M.Link variant="button" underline="none" color="textPrimary" {...props} />
)

const NavSpacer = () => <M.Box ml={{ xs: 2, sm: 3 }} />

const useNavIconStyles = M.makeStyles({
  root: {
    display: 'block',
    height: '18px',
  },
})

interface NavIconProps extends M.BoxProps {
  href: string
  icon: string
  target: string
}

const NavIcon = ({ icon, ...props }: NavIconProps) => {
  const classes = useNavIconStyles()
  return (
    <M.Box component="a" {...props}>
      <img className={classes.root} src={icon} alt="" />
    </M.Box>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    background: `left / 64px url(${bg})`,
    boxShadow: [
      '0px -12px 24px 0px rgba(25, 22, 59, 0.05)',
      '0px -16px 40px 0px rgba(25, 22, 59, 0.07)',
      '0px -24px 88px 0px rgba(25, 22, 59, 0.16)',
    ].join(' '),
    height: 230,
    paddingTop: t.spacing(6),
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      alignItems: 'center',
      display: 'flex',
      paddingTop: 0,
    },
  },
  container: {
    alignItems: 'center',
    display: 'grid',
    [t.breakpoints.up('sm')]: {
      gridRowGap: t.spacing(6),
      gridTemplateColumns: 'auto 1fr auto',
      gridTemplateRows: '36px auto',
      gridTemplateAreas: `
        "logo . links"
        "copy . icons"
      `,
    },
    [t.breakpoints.down('xs')]: {
      gridRowGap: t.spacing(3),
      gridTemplateColumns: '1fr',
      gridTemplateRows: '36px auto auto auto',
      gridTemplateAreas: `
        "logo"
        "links"
        "icons"
        "copy"
      `,
    },
  },
  logoLink: {
    display: 'block',
  },
}))

export default function Footer() {
  const settings = CatalogSettings.use()
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const intercom = Intercom.use()
  const year = React.useMemo(() => new Date().getFullYear(), [])
  const reservedSpaceForIntercom = !intercom.dummy && !intercom.isCustom
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <footer className={classes.root}>
        <M.Container maxWidth="lg" className={classes.container}>
          <M.Box
            style={{ gridArea: 'logo' }}
            display="flex"
            justifyContent={{ xs: 'center', sm: 'flex-start' }}
          >
            {settings?.logo?.url ? (
              <a href={URLS.homeMarketing}>
                <FooterLogo />
              </a>
            ) : (
              <Link className={classes.logoLink} to={urls.home()}>
                <FooterLogo />
              </Link>
            )}
          </M.Box>

          <M.Box
            component="nav"
            display="flex"
            alignItems="center"
            justifyContent={{ xs: 'center', sm: 'flex-end' }}
            style={{ gridArea: 'links' }}
          >
            <NavLink href={URLS.docs} target="_blank">
              Docs
            </NavLink>
            <NavSpacer />
            <NavLink href={URLS.blog} target="_blank">
              Blog
            </NavLink>
            {cfg.mode === 'OPEN' && (
              <>
                <NavSpacer />
                <NavLink href={URLS.jobs} target="_blank">
                  Jobs
                </NavLink>
              </>
            )}
          </M.Box>

          <M.Box
            style={{ gridArea: 'copy' }}
            display="flex"
            justifyContent={{ xs: 'center', sm: 'flex-start' }}
          >
            <M.Typography color="textSecondary">
              &copy;&nbsp;{year} Quilt Data, Inc.
            </M.Typography>
          </M.Box>

          <M.Box
            component="nav"
            display="flex"
            justifyContent={{ xs: 'center', sm: 'flex-end' }}
            style={{ gridArea: 'icons' }}
          >
            <NavIcon icon={iconFacebook} href={URLS.facebook} target="_blank" />
            <NavIcon icon={iconTwitter} href={URLS.twitter} target="_blank" ml={4} />
            <NavIcon icon={iconGithub} href={URLS.gitWeb} target="_blank" ml={4} />
            <NavIcon icon={iconSlack} href={URLS.slackInvite} target="_blank" ml={4} />
            <NavIcon icon={iconInstagram} href={URLS.instagram} target="_blank" ml={4} />
            <NavIcon icon={iconLinkedin} href={URLS.linkedin} target="_blank" ml={4} />
            {reservedSpaceForIntercom && (
              <M.Box ml={4} width={60} display={{ xs: 'none', sm: 'block' }} />
            )}
          </M.Box>
        </M.Container>
        <M.Container maxWidth="lg">
          <React.Suspense fallback={<Skeleton width={80} height={14} />}>
            <Version />
          </React.Suspense>
        </M.Container>
      </footer>
    </M.MuiThemeProvider>
  )
}
