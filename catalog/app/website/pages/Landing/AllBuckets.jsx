import * as React from 'react'
import * as M from '@material-ui/core'
import { ThemeProvider } from '@material-ui/core/styles'

import * as style from 'constants/style'
import MetaTitle from 'utils/MetaTitle'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'

import Buckets from './Buckets'
import usePaletteType from './usePaletteType'

const useStyles = M.makeStyles((t) => ({
  root: {
    minHeight: 'calc(100vh - 64px)',
    overflow: 'hidden',
    position: 'relative',
    // Light page wash from the markup; dark keeps the website base and Dots.
    background:
      t.palette.type === 'dark'
        ? 'none'
        : 'radial-gradient(1000px 460px at 30% -10%, rgba(84,113,241,.12) 0%, rgba(84,113,241,0) 60%), linear-gradient(180deg, #f6f7fb 0%, #eef1f9 100%)',
  },
  themeToggle: {
    color: t.palette.text.secondary,
    position: 'absolute',
    right: t.spacing(2),
    top: t.spacing(2),
    zIndex: 2,
  },
}))

function AllBucketsContent({ paletteType, onTogglePalette }) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      {paletteType === 'dark' && <Dots style={{ bottom: 0 }} />}
      <M.Tooltip
        title={paletteType === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <M.IconButton
          className={classes.themeToggle}
          onClick={onTogglePalette}
          aria-label="Toggle light/dark mode"
        >
          <M.Icon>{paletteType === 'dark' ? 'light_mode' : 'dark_mode'}</M.Icon>
        </M.IconButton>
      </M.Tooltip>
      <Buckets />
    </div>
  )
}

export default function AllBuckets() {
  const palette = usePaletteType()
  const theme = palette.type === 'light' ? style.websiteLightTheme : style.websiteTheme
  return (
    <Layout>
      <MetaTitle>{['Volumes']}</MetaTitle>
      <ThemeProvider theme={theme}>
        <AllBucketsContent paletteType={palette.type} onTogglePalette={palette.toggle} />
      </ThemeProvider>
    </Layout>
  )
}
