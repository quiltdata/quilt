import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router-dom'
import { HashLink } from 'react-router-hash-link'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import * as URLS from 'constants/urls'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'

import logo from 'img/logo/horizontal-white.png'

import messages from './messages'

import bg from './bg.png'
import iconFacebook from './icon-facebook.svg'
import iconGithub from './icon-github.svg'
import iconTwitter from './icon-twitter.svg'
import iconMedium from './icon-medium.svg'

const NavLink = (props) => (
  <M.Link
    variant="button"
    underline="none"
    color="textPrimary"
    component={props.to ? HashLink : undefined}
    {...props}
  />
)

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
    <M.Box
      component="footer"
      position="relative"
      style={{
        background: `left / 64px url(${bg})`,
        boxShadow: `
          0px -12px 24px 0px rgba(25, 22, 59, 0.05),
          0px -16px 40px 0px rgba(25, 22, 59, 0.07),
          0px -24px 88px 0px rgba(25, 22, 59, 0.16)
        `,
      }}
      height={{ xs: 'auto', sm: 230 }}
      pt={{ xs: 4, sm: 6 }}
      pb={{ xs: 4, sm: 0 }}
    >
      <M.Container
        maxWidth="lg"
        style={{ display: 'flex', justifyContent: 'space-between' }}
      >
        <M.Box
          display="flex"
          alignItems={{ xs: 'flex-end', sm: 'flex-start' }}
          flexDirection={{ xs: 'row', sm: 'column' }}
          justifyContent="space-between"
          width={{ xs: '100%', sm: 'auto' }}
        >
          <M.Box
            component={Link}
            to={urls.home()}
            display="block"
            height={36}
            mb={{ xs: 0, sm: 6 }}
          >
            <M.Box component="img" height="100%" alt="Quilt logo" src={logo} />
          </M.Box>

          <M.Typography color="textSecondary">
            &copy;&nbsp;
            <FormattedMessage {...messages.copy} />
          </M.Typography>

          {!intercom.dummy && <M.Box width={60} />}
        </M.Box>

        <M.Box>
          <M.Box
            component="nav"
            display={{ xs: 'none', sm: 'flex' }}
            alignItems="center"
            justifyContent="flex-end"
            height={36}
            mb={6}
          >
            <NavLink href={URLS.docs} target="_blank">
              Docs
            </NavLink>
            {!!cfg.enableMarketingPages && (
              <>
                <M.Box ml={3} />
                <NavLink to={`${urls.home()}#pricing`}>Pricing</NavLink>
              </>
            )}
            <M.Box ml={3} />
            <NavLink href={URLS.blog} target="_blank">
              Blog
            </NavLink>
            <M.Box ml={3} />
            <NavLink href={URLS.jobs} target="_blank">
              Jobs
            </NavLink>
            {!!cfg.enableMarketingPages && (
              <>
                <M.Box ml={3} />
                <NavLink to={urls.about()}>About</NavLink>
              </>
            )}
          </M.Box>

          <M.Box
            component="nav"
            display={{ xs: 'none', sm: 'flex' }}
            justifyContent="flex-end"
          >
            <NavIcon icon={iconFacebook} href={URLS.facebook} target="_blank" />
            <NavIcon icon={iconTwitter} href={URLS.twitter} target="_blank" ml={4} />
            <NavIcon icon={iconGithub} href={URLS.gitWeb} target="_blank" ml={4} />
            <NavIcon icon={iconMedium} href={URLS.blog} target="_blank" ml={4} />
            {!intercom.dummy && <M.Box ml={4} width={60} />}
          </M.Box>
        </M.Box>
      </M.Container>
    </M.Box>
  )
}
