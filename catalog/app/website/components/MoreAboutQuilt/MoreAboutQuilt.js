import * as React from 'react'
import { Box, Icon, Typography } from '@material-ui/core'
import { makeStyles, styled } from '@material-ui/styles'

import * as Layout from 'components/Layout'

import Bar from './Bar'

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

const img2x = (x1, x2) => (window.devicePixelRatio >= 1.5 ? x2 : x1)

const useTileStyles = makeStyles({
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
    position: 'relative',
    width: 352,
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
})

const Tile = ({ icon, title, href }) => {
  const classes = useTileStyles()
  return (
    <div className={classes.root}>
      <img src={img2x(...icon)} alt="" className={classes.icon} />
      <a href={href} className={classes.link}>
        <Typography variant="button" gutterBottom>
          {title}
        </Typography>
        <Typography variant="button" gutterBottom className={classes.learn}>
          Learn more
        </Typography>
        <Icon className={classes.arrow}>arrow_forward</Icon>
      </a>
    </div>
  )
}

const WaveLeft = styled(Box)({
  backgroundImage: `url(${img2x(waveLeft, waveLeft2x)})`,
  backgroundSize: 'cover',
  height: 338,
  position: 'absolute',
  width: 739,
})

const WaveCenter = styled(Box)({
  backgroundImage: `url(${img2x(waveCenter, waveCenter2x)})`,
  backgroundSize: 'cover',
  height: 399,
  position: 'absolute',
  width: 436,
})

const WaveRight = styled(Box)({
  backgroundImage: `url(${img2x(waveRight, waveRight2x)})`,
  backgroundSize: 'cover',
  height: 338,
  position: 'absolute',
  width: 626,
})

export default () => (
  <Layout.Container position="relative">
    <Box display="flex" flexDirection="column" alignItems="center" pt={16}>
      <Bar color="primary" />
      <Box mt={5}>
        <Typography variant="h1">More about Quilt</Typography>
      </Box>
    </Box>
    <Box
      mt={15}
      pb={36}
      display="flex"
      justifyContent="space-between"
      position="relative"
    >
      <Tile icon={[iconDocs, iconDocs2x]} href="" title="Docs" />
      <WaveLeft top={68} right={815} />
      <Tile icon={[iconGithub, iconGithub2x]} href="" title="Github" />
      <WaveCenter top={68} left={352} />
      <Tile icon={[iconBlog, iconBlog2x]} href="" title="Blog" />
      <WaveRight top={84} left={907} />
    </Box>
  </Layout.Container>
)
