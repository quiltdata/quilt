import * as React from 'react'
import * as M from '@material-ui/core'

import Bar from 'website/components/Bar'
import ChevronLink from 'website/components/ChevronLink'
import Overlay1Full from 'website/components/Backgrounds/Overlay1Full'
import Overlay2 from 'website/components/Backgrounds/Overlay2'

import Screenshots from 'website/components/Screenshots'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    marginTop: t.spacing(8),
    [t.breakpoints.up('md')]: {
      marginTop: t.spacing(12),
    },
  },
  container: {
    display: 'grid',
    paddingBottom: t.spacing(5),
    position: 'relative',
    [t.breakpoints.up('md')]: {
      gridColumnGap: t.spacing(10),
      gridTemplateColumns: '1fr 1fr',
      gridTemplateAreas: '"text carousel"',
    },
    [t.breakpoints.up('lg')]: {
      gridTemplateColumns: '1fr 640px',
    },
    [t.breakpoints.down('sm')]: {
      gridRowGap: t.spacing(8),
      gridTemplateRows: 'auto auto',
      gridTemplateAreas: `
        "text"
        "carousel"
      `,
    },
  },
  text: {
    gridArea: 'text',
    [t.breakpoints.up('lg')]: {
      paddingTop: t.spacing(6),
    },
  },
  carousel: {
    gridArea: 'carousel',
  },
}))

export default function Showcase() {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      <Overlay2 />
      <Overlay1Full top={-80} />
      <M.Container maxWidth="lg" className={classes.container}>
        <div className={classes.text}>
          <Bar color="primary" />
          <M.Box mt={5}>
            <M.Typography variant="h1" color="textPrimary">
              Publish and discover unlimited data
            </M.Typography>
          </M.Box>
          <M.Box mt={4}>
            <M.Typography variant="body1" color="textSecondary">
              Quilt is a versioned data portal for AWS. open.quiltdata.com offers access
              to the world&apos;s public data in S3, including Amazon&apos;s Registry of
              Open Data.
            </M.Typography>
          </M.Box>
          <M.Box mt={4}>
            <ChevronLink href="https://open.quiltdata.com/b/quilt-example/tree/robnewman/us_county_smoking_vs_poverty/">
              Explore visualizations and notebooks
            </ChevronLink>
          </M.Box>
          <M.Box mt={2}>
            <ChevronLink href="https://open.quiltdata.com/b/quilt-example/tree/akarve/previews/storms.parquet">
              Preview file formats (Parquet, Excel, VCF, and more)
            </ChevronLink>
          </M.Box>
          <M.Box mt={2}>
            <ChevronLink href="https://open.quiltdata.com/b/quilt-example/tree/akarve/previews/terrain/">
              Browse directories of images
            </ChevronLink>
          </M.Box>
          <M.Box mt={4}>
            <M.Button variant="contained" color="secondary" href="#demo-video">
              Learn more
            </M.Button>
          </M.Box>
        </div>
        <Screenshots className={classes.carousel} />
      </M.Container>
    </div>
  )
}
