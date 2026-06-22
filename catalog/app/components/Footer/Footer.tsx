import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import Logo from 'components/Logo'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import bg from './bg.png'
import iconFacebook from './icon-facebook.svg'
import iconGithub from './icon-github.svg'
import iconInstagram from './icon-instagram.svg'
import iconLinkedin from './icon-linkedin.svg'
import iconSlack from './icon-slack.svg'
import iconTwitter from './icon-twitter.svg'

const useVersionStyles = M.makeStyles({
  revision: {
    color: 'rgba(255,255,255,.45)',
    cursor: 'pointer',
    '&:hover': {
      color: '#fff',
    },
  },
})

function Version() {
  const classes = useVersionStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(cfg.stackVersion)
    push('Web catalog container hash has been copied to clipboard')
  }, [push])
  return (
    <M.Typography
      className={classes.revision}
      onClick={handleCopy}
      title="Copy Platform release version to clipboard"
      variant="caption"
    >
      Version: {cfg.stackVersion}
    </M.Typography>
  )
}

const FooterLogo = () => <Logo height="29px" width="76.5px" />

const NavLink = (props: M.LinkProps) => (
  <M.Link variant="button" underline="none" color="textPrimary" {...props} />
)

const NavSpacer = () => <M.Box ml={{ xs: 2, sm: 2 }} />

const useNavIconStyles = M.makeStyles({
  root: {
    display: 'block',
    height: '18px',
    // SVG icons from the footer sprite are dark-coloured; invert them to white
    // so they match the left-side Logo/text on the dark footer background.
    filter: 'brightness(0) invert(1)',
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
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
    ].join(', '),
    display: 'flex',
    alignItems: 'center',
    minHeight: 72,
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      paddingBottom: t.spacing(2),
      paddingTop: t.spacing(2),
    },
  },
  container: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(3),
    width: '100%',
    [t.breakpoints.down('xs')]: {
      flexDirection: 'column',
      gap: t.spacing(2),
      textAlign: 'center',
    },
  },
  left: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
    [t.breakpoints.down('xs')]: {
      flexDirection: 'column',
      gap: t.spacing(1),
    },
  },
  right: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
    marginLeft: 'auto',
    [t.breakpoints.down('xs')]: {
      flexDirection: 'column',
      gap: t.spacing(1.5),
      marginLeft: 0,
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
          <div className={classes.left}>
            {settings?.logo?.url ? (
              <a href={URLS.homeMarketing}>
                <FooterLogo />
              </a>
            ) : (
              <Link className={classes.logoLink} to={urls.home()}>
                <FooterLogo />
              </Link>
            )}
            <M.Typography color="textSecondary" variant="body2">
              &copy;&nbsp;{year} Quilt Data, Inc.
            </M.Typography>
          </div>

          <M.Box component="nav" display="flex" alignItems="center">
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

          <div className={classes.right}>
            <M.Box component="nav" display="flex" alignItems="center">
              <NavIcon icon={iconFacebook} href={URLS.facebook} target="_blank" />
              <NavIcon icon={iconTwitter} href={URLS.twitter} target="_blank" ml={3} />
              <NavIcon icon={iconGithub} href={URLS.gitWeb} target="_blank" ml={3} />
              <NavIcon icon={iconSlack} href={URLS.slackInvite} target="_blank" ml={3} />
              <NavIcon
                icon={iconInstagram}
                href={URLS.instagram}
                target="_blank"
                ml={3}
              />
              <NavIcon icon={iconLinkedin} href={URLS.linkedin} target="_blank" ml={3} />
            </M.Box>
            <Version />
            {reservedSpaceForIntercom && (
              <M.Box width={60} display={{ xs: 'none', sm: 'block' }} />
            )}
          </div>
        </M.Container>
      </footer>
    </M.MuiThemeProvider>
  )
}
