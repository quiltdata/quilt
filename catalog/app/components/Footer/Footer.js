import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import Logo from 'components/Logo'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as Config from 'utils/Config'
import HashLink from 'utils/HashLink'
import * as NamedRoutes from 'utils/NamedRoutes'

import messages from './messages'

import bg from './bg.png'
import iconFacebook from './icon-facebook.svg'
import iconGithub from './icon-github.svg'
import iconTwitter from './icon-twitter.svg'
import iconMedium from './icon-medium.svg'

const Footer = M.styled('footer')(({ theme: t }) => ({
  background: `left / 64px url(${bg})`,
  boxShadow: [
    '0px -12px 24px 0px rgba(25, 22, 59, 0.05)',
    '0px -16px 40px 0px rgba(25, 22, 59, 0.07)',
    '0px -24px 88px 0px rgba(25, 22, 59, 0.16)',
  ],
  height: 230,
  paddingTop: t.spacing(6),
  position: 'relative',
  [t.breakpoints.down('xs')]: {
    alignItems: 'center',
    display: 'flex',
    paddingTop: 0,
  },
}))

const Container = M.styled(M.Container)(({ theme: t }) => ({
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
}))

const NavLink = (props) => (
  <M.Link
    variant="button"
    underline="none"
    color="textPrimary"
    component={props.to ? HashLink : undefined}
    {...props}
  />
)

const NavSpacer = () => <M.Box ml={{ xs: 2, sm: 3 }} />

const NavIcon = ({ icon, ...props }) => (
  <M.Box component="a" {...props}>
    <M.Box component="img" height={18} src={icon} alt="" display="block" />
  </M.Box>
)

export default () => {
  const cfg = Config.useConfig()
  const { urls } = NamedRoutes.use()
  const intercom = Intercom.use()
  return (
    <M.MuiThemeProvider theme={style.navTheme}>
      <Footer>
        <Container maxWidth="lg">
          <M.Box
            style={{ gridArea: 'logo' }}
            display="flex"
            justifyContent={{ xs: 'center', sm: 'flex-start' }}
          >
            <M.Box component={Link} to={urls.home()} display="block">
              <Logo />
            </M.Box>
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
            {!!cfg.enableMarketingPages && (
              <>
                <NavSpacer />
                <NavLink to={`${urls.home()}#pricing`}>Pricing</NavLink>
              </>
            )}
            <NavSpacer />
            <NavLink href={URLS.blog} target="_blank">
              Blog
            </NavLink>
            <NavSpacer />
            <NavLink href={URLS.jobs} target="_blank">
              Jobs
            </NavLink>
            {!!cfg.enableMarketingPages && (
              <>
                <NavSpacer />
                <NavLink to={urls.about()}>About</NavLink>
              </>
            )}
          </M.Box>

          <M.Box
            style={{ gridArea: 'copy' }}
            display="flex"
            justifyContent={{ xs: 'center', sm: 'flex-start' }}
          >
            <M.Typography color="textSecondary">
              &copy;&nbsp;
              <FormattedMessage {...messages.copy} />
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
            <NavIcon icon={iconMedium} href={URLS.blog} target="_blank" ml={4} />
            {!intercom.dummy && (
              <M.Box ml={4} width={60} display={{ xs: 'none', sm: 'block' }} />
            )}
          </M.Box>
        </Container>
      </Footer>
    </M.MuiThemeProvider>
  )
}
