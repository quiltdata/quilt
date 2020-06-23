import * as React from 'react'
import * as M from '@material-ui/core'

import logoAics from './logo-aics.png'
import logoCelsius from './logo-celsius.png'
import logoCredit from './logo-credit.png'
import logoHudl from './logo-hudl.png'
import logoRibon from './logo-ribon.png'
import logoSight from './logo-sight.png'

// TODO: inesrt relevant hrefs, double-check titles
const logos = [
  {
    src: logoAics,
    height: 55,
    title: 'Allen Institute for Cell Science',
    // href: '',
  },
  {
    src: logoSight,
    title: 'Sighthound',
    height: 60,
    // href: '',
  },
  {
    src: logoHudl,
    height: 55,
    title: 'hudl',
    // href: '',
  },
  {
    src: logoCelsius,
    height: 48,
    title: 'Celsius',
    // href: '',
  },
  {
    src: logoRibon,
    title: 'Ribon Therapeutics',
    height: 65,
    // href: '',
  },
  {
    src: logoCredit,
    height: 61,
    title: 'The Credit Junction',
    // href: '',
  },
]

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: t.spacing(14),
    paddingTop: t.spacing(2),
    position: 'relative',
  },
  logos: {
    alignItems: 'center',
    display: 'flex',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: t.spacing(9),
    maskImage:
      'linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 64px calc(100% - 64px), rgba(0,0,0,0))',
    maxWidth: '100%',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    MsOverflowStyle: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  link: {
    cursor: 'pointer',
    paddingLeft: t.spacing(4),
    paddingRight: t.spacing(4),
    '&:first-child': {
      paddingLeft: t.spacing(8),
    },
    '&:last-child': {
      paddingRight: t.spacing(8),
    },
  },
  img: {
    display: 'block',
  },
}))

export default function Logos() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <M.Container maxWidth="lg">
        <M.Typography variant="h1" color="textPrimary" align="center">
          Companies that love Quilt
        </M.Typography>
      </M.Container>
      <div className={classes.logos}>
        {logos.map((l) => (
          <a href={l.href} className={classes.link} key={l.title}>
            <img
              title={l.title}
              alt={l.title}
              src={l.src}
              className={classes.img}
              style={{ height: l.height }}
            />
          </a>
        ))}
      </div>
    </div>
  )
}
