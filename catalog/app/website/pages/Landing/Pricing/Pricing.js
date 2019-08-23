import * as React from 'react'
import * as M from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

import img2x from 'utils/img2x'
import scrollIntoView from 'utils/scrollIntoView'
import styledBy from 'utils/styledBy'

import Bar from 'website/components/Bar'
import Backlight from 'website/components/Backgrounds/Backlight4'
import Plus from 'website/components/Plus'

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

const usePlanStyles = makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    [t.breakpoints.down('sm')]: {
      maxWidth: 410,
      width: '100%',
      '& + &': {
        marginTop: t.spacing(8),
      },
    },
    [t.breakpoints.up('md')]: {
      marginLeft: styledBy('featured', { true: -100 }),
      marginRight: styledBy('featured', { true: -100 }),
      maxWidth: styledBy('featured', { false: 410, true: 480 }),
      position: styledBy('featured', { true: 'relative' }),
      width: styledBy('featured', { false: '35%', true: '40%' }),
      zIndex: styledBy('featured', { true: 1 }),
    },
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
        <M.Typography variant="h3" color="textPrimary" className={classes.name}>
          {name}
        </M.Typography>
        <M.Typography variant="h1" color="textPrimary" className={classes.price}>
          {price}
        </M.Typography>
        <M.Typography
          variant="caption"
          color="textSecondary"
          className={classes.perMonth}
        >
          $ per month
        </M.Typography>
      </div>
      <div className={classes.featureBox}>
        {features.map((f) => (
          <M.Typography
            className={classes.feature}
            variant="caption"
            color="textSecondary"
            key={f}
          >
            {f}
          </M.Typography>
        ))}
      </div>
      <Plus variant={plus} href="TBD" />
    </div>
  )
}

export default () => (
  <M.Box position="relative">
    <Backlight top={-320} />
    <M.Container maxWidth="lg">
      <M.Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        pt={10}
        position="relative"
      >
        <Bar color="secondary" />
        <M.Box mt={5}>
          <M.Typography
            variant="h1"
            color="textPrimary"
            id="pricing"
            ref={scrollIntoView()}
          >
            Pricing
          </M.Typography>
        </M.Box>
      </M.Box>
      <M.Box
        mt={10}
        pb={10}
        display="flex"
        justifyContent="space-between"
        position="relative"
        flexDirection={{ xs: 'column', md: 'row' }}
        alignItems="center"
      >
        <Plan {...PLANS.free} />
        <Plan {...PLANS.hosted} featured />
        <Plan {...PLANS.vpc} />
      </M.Box>
    </M.Container>
  </M.Box>
)
