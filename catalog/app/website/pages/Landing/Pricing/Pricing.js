import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import img2x from 'utils/img2x'
import scrollIntoView from 'utils/scrollIntoView'
import { useTracker } from 'utils/tracking'

import Bar from 'website/components/Bar'
import Backlight from 'website/components/Backgrounds/Backlight4'

import bgPri from './bg-primary.png'
import bgPri2x from './bg-primary@2x.png'
import bgSec from './bg-secondary.png'
import bgSec2x from './bg-secondary@2x.png'
import bgTer from './bg-tertiary.png'
import bgTer2x from './bg-tertiary@2x.png'

const PLANS = [
  {
    name: 'open.quiltdata.com',
    trackingName: 'open',
    price: 0,
    features: ['Unlimited public packages'],
    cta: 'Explore',
    href: 'https://open.quiltdata.com',
    variant: 'tertiary',
  },
  {
    name: 'Virtual Private Cloud',
    trackingName: 'marketplace',
    price: 600,
    features: ['Unlimited data', 'Unlimited users', 'One S3 bucket', '30-day free trial'],
    cta: 'Try Now',
    to: ({ urls }) => urls.install(),
    variant: 'primary',
    featured: true,
  },
  {
    name: 'Enterprise',
    trackingName: 'contact',
    price: 999,
    features: [
      'Unlimited data',
      'Unlimited users',
      'Up to five S3 buckets',
      'Priority support',
      'Custom features',
      'Education and instruction',
      '30-day free trial',
    ],
    cta: 'Contact',
    href: 'mailto:sales@quiltdata.io?subject=Quilt Enterprise',
    variant: 'secondary',
  },
]

function Btn({ to, trackingName, ...rest }) {
  const { urls } = NamedRoutes.use()
  const t = useTracker()
  const trackingArgs = ['WEB', { type: 'action', location: `/#${trackingName}` }]
  const track = React.useMemo(
    () => (to ? () => t.track(...trackingArgs) : t.trackLink(...trackingArgs)),
    [t, to, trackingName],
  )
  const props = to ? { component: Link, to: to({ urls }), ...rest } : rest
  return <M.Button onClick={track} {...props} />
}

const useStyles = M.makeStyles((t) => ({
  root: {},
  plans: {
    alignItems: 'stretch',
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(13),
    paddingBottom: t.spacing(10),
    position: 'relative',
    [t.breakpoints.down('sm')]: {
      alignItems: 'center',
      flexDirection: 'column',
      marginTop: t.spacing(1),
    },
  },
  plan: {
    alignItems: 'center',
    backgroundPosition: 'top center',
    backgroundSize: 'cover',
    borderRadius: 19,
    boxShadow: '0px 24px 12px 0 rgba(26, 28, 67, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 400,
    width: '40%',
    zIndex: 0,
    [t.breakpoints.down('sm')]: {
      marginTop: t.spacing(6),
      width: '100%',
    },
  },
  featured: {
    [t.breakpoints.up('md')]: {
      marginBottom: 52,
      marginLeft: -32,
      marginRight: -32,
      marginTop: -52,
      maxWidth: 428,
      position: 'relative',
      zIndex: 1,
    },
    [t.breakpoints.up('lg')]: {
      marginLeft: -44,
      marginRight: -44,
    },
  },
  primary: {
    backgroundImage: `url(${img2x(bgPri, bgPri2x)})`,
  },
  secondary: {
    backgroundImage: `url(${img2x(bgSec, bgSec2x)})`,
  },
  tertiary: {
    backgroundImage: `url(${img2x(bgTer, bgTer2x)})`,
  },
  name: {
    ...t.typography.h3,
    color: t.palette.text.primary,
    lineHeight: '3rem',
    marginTop: t.spacing(5),
  },
  price: {
    ...t.typography.h1,
    color: t.palette.text.primary,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: 1.5,
  },
  perMonth: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    fontStyle: 'italic',
  },
  featureBox: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    height: 160,
    justifyContent: 'center',
    marginTop: t.spacing(10),
  },
  feature: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    fontStyle: 'italic',
    lineHeight: 2,
  },
  btn: {
    marginBottom: t.spacing(4),
    marginTop: t.spacing(2),
    width: 160,
    '$tertiary &': {
      color: t.palette.tertiary.contrastText,
      backgroundImage: [
        'linear-gradient(225deg, #bde7d6, #4088da)',
        'linear-gradient(to top, #000000, rgba(255, 255, 255, 0.7))',
      ],
    },
  },
}))

export default function Pricing() {
  const classes = useStyles()
  return (
    <M.Box position="relative">
      <Backlight top={-320} />
      <M.Container maxWidth="lg">
        <M.Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          pt={20}
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
        <div className={classes.plans}>
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cx(
                classes.plan,
                classes[p.variant],
                p.featured && classes.featured,
              )}
            >
              <div className={classes.name}>{p.name}</div>
              <div className={classes.price}>{p.price}</div>
              <div className={classes.perMonth}>$ per month</div>

              <div className={classes.featureBox}>
                {p.features.map((f) => (
                  <div className={classes.feature} key={f}>
                    {f}
                  </div>
                ))}
              </div>

              <Btn
                variant="contained"
                className={classes.btn}
                color={p.variant !== 'tertiary' ? p.variant : undefined}
                href={p.href}
                to={p.to}
                trackingName={p.trackingName}
              >
                {p.cta}
              </Btn>
            </div>
          ))}
        </div>
      </M.Container>
    </M.Box>
  )
}
