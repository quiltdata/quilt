import * as React from 'react'
import * as M from '@material-ui/core'
import { makeStyles, styled } from '@material-ui/styles'

import img2x from 'utils/img2x'
import Bar from 'website/components/Bar'

import tile from './tile.png'
import tile2x from './tile@2x.png'

import iconBlog from './icon-blog.png'
import iconBlog2x from './icon-blog@2x.png'
import iconDocs from './icon-docs.png'
import iconDocs2x from './icon-docs@2x.png'
import iconGithub from './icon-github.png'
import iconGithub2x from './icon-github@2x.png'

import waveLeft from './wave-left.png'
import waveLeft2x from './wave-left@2x.png'
import waveCenter from './wave-center.png'
import waveCenter2x from './wave-center@2x.png'
import waveRight from './wave-right.png'
import waveRight2x from './wave-right@2x.png'

const useTileStyles = makeStyles((t) => ({
  root: {
    alignItems: 'center',
    backgroundImage: `url(${img2x(tile, tile2x)})`,
    backgroundSize: 'cover',
    boxShadow: [
      '0px 12px 24px 0px rgba(25, 22, 59, 0.16)',
      '0px 16px 40px 0px rgba(25, 22, 59, 0.24)',
      '0px 24px 88px 0px rgba(25, 22, 59, 0.56)',
    ],
    borderRadius: 19,
    display: 'flex',
    flexDirection: 'column',
    height: 352,
    marginTop: t.spacing(5),
    maxWidth: 352,
    position: 'relative',
    width: '100%',
  },
  icon: {
    height: 115,
    marginTop: 40,
    width: 115,
  },
  link: {
    marginTop: 50,
    position: 'relative',
    textAlign: 'center',
    zIndex: 1,
  },
  learn: {
    color: '#78a5fe',
  },
  arrow: {
    color: '#5b9dff',
  },
}))

const Tile = ({ icon, title, href }) => {
  const classes = useTileStyles()
  return (
    <div className={classes.root}>
      <img src={img2x(...icon)} alt="" className={classes.icon} />
      <a href={href} className={classes.link}>
        <M.Typography variant="button" color="textPrimary" display="block" gutterBottom>
          {title}
        </M.Typography>
        <M.Typography
          variant="button"
          display="block"
          gutterBottom
          className={classes.learn}
        >
          Learn more
        </M.Typography>
        <M.Icon className={classes.arrow}>arrow_forward</M.Icon>
      </a>
    </div>
  )
}

const mkWave = ({ srcs, height, width }) =>
  styled((props) => (
    <M.Box
      height={height}
      width={width}
      position="absolute"
      display={{ xs: 'none', lg: 'block' }}
      {...props}
    />
  ))({
    backgroundImage: `url(${img2x(...srcs)})`,
    backgroundSize: 'cover',
    position: 'absolute',
  })

const WaveLeft = mkWave({ srcs: [waveLeft, waveLeft2x], height: 338, width: 739 })
const WaveCenter = mkWave({ srcs: [waveCenter, waveCenter2x], height: 399, width: 436 })
const WaveRight = mkWave({ srcs: [waveRight, waveRight2x], height: 338, width: 626 })

export default () => (
  <M.Container maxWidth="lg" style={{ position: 'relative' }}>
    <M.Box display="flex" flexDirection="column" alignItems="center" pt={10}>
      <Bar color="primary" />
      <M.Box mt={5}>
        <M.Typography variant="h1" color="textPrimary">
          More about Quilt
        </M.Typography>
      </M.Box>
    </M.Box>
    <M.Box
      mt={{ xs: 5, lg: 10 }}
      pb={{ xs: 20, lg: 36 }}
      mx="auto"
      width={{ lg: 1140 }}
      position="relative"
      display="flex"
      justifyContent="space-between"
      flexDirection={{ xs: 'column', lg: 'row' }}
      alignItems="center"
    >
      <Tile icon={[iconDocs, iconDocs2x]} href="" title="Docs" />
      <WaveLeft top={108} right={815} />
      <Tile icon={[iconGithub, iconGithub2x]} href="" title="Github" />
      <WaveCenter top={108} left={352} />
      <Tile icon={[iconBlog, iconBlog2x]} href="" title="Blog" />
      <WaveRight top={124} left={907} />
    </M.Box>
  </M.Container>
)
