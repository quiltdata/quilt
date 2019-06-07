import * as React from 'react'
import { Box, Typography } from '@material-ui/core'
import { makeStyles, styled } from '@material-ui/styles'

import * as Layout from 'components/Layout'
import styledBy from 'utils/styledBy'

import Bar from './Bar'
import Plus from './Plus'

import backlight from './backlight4.png'
import pricingFree from './pricing-free.png'
import pricingFree2x from './pricing-free@2x.png'
import pricingHosted from './pricing-hosted.png'
import pricingHosted2x from './pricing-hosted@2x.png'
import pricingVpc from './pricing-vpc.png'
import pricingVpc2x from './pricing-vpc@2x.png'

const PLANS = {
  free: {
    bg: [pricingFree, pricingFree2x],
    name: 'Free',
    price: 0,
    features: ['Unlimited public packages'],
    plus: 'tertiary',
  },
  hosted: {
    bg: [pricingHosted, pricingHosted2x],
    name: 'Hosted',
    price: 550,
    features: [
      'Unlimited public packages',
      '1TB and up of private packages',
      'Admin and auditing features',
      'Dedicated web catalog',
    ],
    plus: 'primary',
  },
  vpc: {
    bg: [pricingVpc, pricingVpc2x],
    name: 'VPC in AWS',
    price: 900,
    features: [
      'Unlimited public packages',
      'Admin and auditing features',
      'Dedicated web catalog',
      'Priority support',
      'Custom SSO (LDAP, Active Directory, etc.)',
    ],
    plus: 'secondary',
  },
}

const img2x = (x1, x2) => (window.devicePixelRatio >= 1.5 ? x2 : x1)

const usePlanStyles = makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    marginLeft: styledBy('featured', { true: -100 }),
    marginRight: styledBy('featured', { true: -100 }),
    marginTop: styledBy('featured', { false: 50 }),
    position: styledBy('featured', { true: 'relative' }),
    width: styledBy('featured', { false: 400, true: 460 }),
    zIndex: styledBy('featured', { true: 1 }),
  },
  bgBox: {
    alignItems: 'center',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    borderRadius: 19,
    boxShadow: styledBy('featured', {
      true: [
        '0px 12px 24px 0 rgba(25, 22, 59, 0.12)',
        '0px 16px 40px 0 rgba(25, 22, 59, 0.18)',
        '0px 24px 88px 0 rgba(25, 22, 59, 0.42)',
      ],
      false: [
        '0px 12px 24px 0 rgba(25, 22, 59, 0.08)',
        '0px 16px 40px 0 rgba(25, 22, 59, 0.12)',
        '0px 24px 88px 0 rgba(25, 22, 59, 0.28)',
      ],
    }),
    display: 'flex',
    flexDirection: 'column',
    height: 360,
    width: '100%',
    zIndex: 0,
  },
  name: {
    lineHeight: '3rem',
    marginTop: 190,
  },
  price: {
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: 1.5,
  },
  perMonth: {
    fontStyle: 'italic',
  },
  featureBox: {
    alignItems: 'center',
    background: 'linear-gradient(to top, #212455, #2a2b64)',
    boxShadow: [
      '0px 12px 24px 0 rgba(25, 22, 59, 0.16)',
      '0px 16px 40px 0 rgba(25, 22, 59, 0.24)',
      '0px 24px 88px 0 rgba(25, 22, 59, 0.56)',
    ],
    borderRadius: [[0, 0, 19, 19]],
    display: 'flex',
    flexDirection: 'column',
    height: styledBy('featured', { false: 330, true: 430 }),
    justifyContent: 'center',
    marginBottom: -36,
    paddingBottom: 36,
    width: 'calc(100% - 32px)',
  },
  feature: {
    fontStyle: 'italic',
    lineHeight: 4,
  },
}))

const Plan = ({ bg, name, price, features, plus, featured = false }) => {
  const classes = usePlanStyles({ featured })
  return (
    <div className={classes.root}>
      <div className={classes.bgBox} style={{ backgroundImage: `url(${img2x(...bg)})` }}>
        <Typography variant="h3" className={classes.name}>
          {name}
        </Typography>
        <Typography variant="h1" className={classes.price}>
          {price}
        </Typography>
        <Typography variant="caption" color="textSecondary" className={classes.perMonth}>
          $ per month
        </Typography>
      </div>
      <div className={classes.featureBox}>
        {features.map((f) => (
          <Typography
            className={classes.feature}
            variant="caption"
            color="textSecondary"
            key={f}
          >
            {f}
          </Typography>
        ))}
      </div>
      <Plus variant={plus} />
    </div>
  )
}

const Backlight = styled('div')({
  backgroundImage: `url(${backlight})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 2059,
  left: 0,
  position: 'absolute',
  right: 0,
  top: -320,
})

export default () => (
  <Box position="relative">
    <Backlight />
    <Layout.Container>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        pt={10}
        position="relative"
      >
        <Bar color="secondary" />
        <Box mt={5}>
          <Typography variant="h1">Pricing</Typography>
        </Box>
      </Box>
      <Box mt={10} display="flex" justifyContent="space-between" position="relative">
        <Plan {...PLANS.free} />
        <Plan {...PLANS.hosted} featured />
        <Plan {...PLANS.vpc} />
      </Box>
    </Layout.Container>
  </Box>
)
