import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'
import Bar from 'website/components/Bar'

import partner from './partner.png'
import partner2x from './partner@2x.png'
import art from './art.png'
import art2x from './art@2x.png'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: t.spacing(15),
    paddingTop: t.spacing(8),
    position: 'relative',
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  text: {
    paddingTop: t.spacing(5),
    position: 'relative',
    maxWidth: 400,
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
        <img
          className={classes.partner}
          src={img2x(partner, partner2x)}
          alt="AWS Advanced Technology Partner"
        />
      </div>
      <img className={classes.art} src={img2x(art, art2x)} alt="" />
    </M.Container>
  )
}
