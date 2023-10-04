import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'
import AwsPartner from 'website/components/AwsPartner'
import Bar from 'website/components/Bar'

import art from './art.png'
import art2x from './art@2x.png'
import backlight from './backlight.png'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    position: 'relative',
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  text: {
    paddingTop: t.spacing(5),
    position: 'relative',
    maxWidth: 400,
    zIndex: 1,
    [t.breakpoints.down('sm')]: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      textAlign: 'center',
    },
  },
  partner: {
    width: 237,
  },
  art: {
    position: 'relative',
    [t.breakpoints.down('sm')]: {
      marginBottom: t.spacing(1),
      marginTop: t.spacing(4),
      maxWidth: 862,
      order: -1,
      width: '100%',
    },
    [t.breakpoints.up('md')]: {
      marginLeft: -200,
      marginRight: 'calc(34vw - 535px)',
      marginTop: t.spacing(5),
      width: 862,
    },
    [t.breakpoints.up('lg')]: {
      marginRight: -100,
    },
    '& img': {
      position: 'relative',
      width: '100%',
    },
    '&::before': {
      background: `center / contain no-repeat url(${backlight})`,
      content: '""',
      left: '-48%',
      paddingTop: `${(1432 / 862) * 100}%`,
      position: 'absolute',
      top: '-43%',
      width: `${(1605 / 862) * 100}%`,
    },
  },
}))

export default function Platform() {
  const classes = useStyles()
  return (
    <M.Container maxWidth="lg" className={classes.root}>
      <div className={classes.text}>
        <Bar color="primary" />
        <M.Box mt={6}>
          <M.Typography variant="h1" color="textPrimary">
            Choose a proven data platform
          </M.Typography>
        </M.Box>
        <M.Box mt={5}>
          <M.Typography variant="body1" color="textSecondary">
            Companies with terabytes of data choose Quilt. Since Quilt is built on top of
            S3, you can use your existing buckets, data lakes and compute services.
          </M.Typography>
        </M.Box>
        <M.Box mt={3} mb={6}>
          <M.Typography variant="body1" color="textSecondary">
            Quilt is built on an open-source core that you can modify to meet your
            team&apos;s needs.
          </M.Typography>
        </M.Box>
        <AwsPartner className={classes.partner} />
      </div>
      <div className={classes.art}>
        <img src={img2x(art, art2x)} alt="" />
      </div>
    </M.Container>
  )
}
