import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { Link as RRLink } from 'react-router-dom'
import { unstable_Box as Box } from '@material-ui/core/Box'
import { Link, Typography } from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import LayoutContainer from 'components/Layout/Container'
import { blog, twitter, gitWeb } from 'constants/urls'
import * as NamedRoutes from 'utils/NamedRoutes'

import logo from 'img/logo/horizontal-white.png'

import messages from './messages'

import bg from './bg.png'
import iconFacebook from './icon-facebook.svg'
import iconGithub from './icon-github.svg'
import iconTwitter from './icon-twitter.svg'
import iconMedium from './icon-medium.svg'

const NavLink = (props) => (
  <Link
    variant="button"
    underline="none"
    color="textPrimary"
    component={props.to ? RRLink : undefined}
    {...props}
  />
)

const NavIcon = ({ icon, ...props }) => (
  <Box component="a" {...props}>
    <Box component="img" height={18} src={icon} alt="" display="block" />
  </Box>
)

export default () => {
  const { urls } = NamedRoutes.use()
  const intercom = Intercom.use()
  return (
    <Box
      component="footer"
      style={{
        background: `left / 64px url(${bg})`,
        boxShadow: `
          0px -12px 24px 0px rgba(25, 22, 59, 0.05),
          0px -16px 40px 0px rgba(25, 22, 59, 0.07),
          0px -24px 88px 0px rgba(25, 22, 59, 0.16)
        `,
      }}
      height={230}
      pt={6}
    >
      <LayoutContainer display="flex" justifyContent="space-between">
        <Box>
          <Box component={RRLink} to={urls.home()} display="block" height={36} mb={6}>
            <Box component="img" height="100%" alt="Quilt logo" src={logo} />
          </Box>

          <Typography color="textSecondary">
            &copy;&nbsp;
            <FormattedMessage {...messages.copy} />
          </Typography>
        </Box>

        <Box>
          {/* TODO: hide this nav when enableMarketingPages is false? */}
          <Box
            component="nav"
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            height={36}
            mb={6}
          >
            <NavLink href="TBD">Docs</NavLink>
            <Box ml={3} />
            <NavLink href="TBD">Pricing</NavLink>
            <Box ml={3} />
            <NavLink href={blog}>Blog</NavLink>
            <Box ml={3} />
            <NavLink href="TBD">Jobs</NavLink>
            <Box ml={3} />
            <NavLink to={urls.about()}>About</NavLink>
          </Box>

          <Box component="nav" display="flex" justifyContent="flex-end">
            <NavIcon icon={iconFacebook} href="TBD" />
            <NavIcon icon={iconTwitter} href={twitter} ml={4} />
            <NavIcon icon={iconGithub} href={gitWeb} ml={4} />
            <NavIcon icon={iconMedium} href={blog} ml={4} />
            {!intercom.dummy && <Box ml={4} width={60} />}
          </Box>
        </Box>
      </LayoutContainer>
    </Box>
  )
}
