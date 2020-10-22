import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'
import scrollIntoView from 'utils/scrollIntoView'

import Bullet from 'website/components/Bullet'

import art from './art.png'
import art2x from './art@2x.png'

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(45),
    position: 'relative',
    [t.breakpoints.down('sm')]: {
      paddingTop: t.spacing(35),
    },
  },
  bg: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
  },
  container: {},
  inner: {
    position: 'relative',
    [t.breakpoints.down('sm')]: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: 480,
      width: '100%',
    },
  },
  text: {
    paddingBottom: t.spacing(10),
    paddingTop: t.spacing(10),
    width: 420,
    [t.breakpoints.only('md')]: {
      paddingBottom: t.spacing(6),
      paddingTop: t.spacing(6),
    },
    [t.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  art: {
    [t.breakpoints.up('md')]: {
      bottom: t.spacing(2),
      position: 'absolute',
      right: 0,
      width: 559,
    },
    [t.breakpoints.only('md')]: {
      width: 450,
    },
    [t.breakpoints.down('sm')]: {
      marginTop: -70,
      width: '100%',
    },
  },
}))

export default function QuiltIsDifferent() {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      <div className={classes.bg}>
        <M.Container maxWidth="lg" className={classes.container}>
          <div className={classes.inner}>
            <img src={img2x(art, art2x)} className={classes.art} alt="" />
            <div className={classes.text}>
              <M.Typography
                id="quilt-is-different"
                variant="h1"
                color="textPrimary"
                ref={scrollIntoView()}
              >
                Quilt is different
              </M.Typography>
              <M.Box mt={4}>
                <Bullet color="primary" dense>
                  <strong>Unlimited scale</strong>, backed by AWS S3
                </Bullet>
                <Bullet color="primary" dense>
                  <strong>Privacy and control</strong> &mdash; data in Quilt can remain in
                  buckets that you control
                </Bullet>
                <Bullet color="primary" dense>
                  <strong>Quilt does not advertise</strong> against your data or your
                  metadata
                </Bullet>
                <Bullet color="primary" dense>
                  <strong>Performance</strong> &mdash; if you are computing in AWS, Quilt
                  is the fastest, cheapest way access data
                </Bullet>
              </M.Box>
            </div>
          </div>
        </M.Container>
      </div>
    </div>
  )
}
