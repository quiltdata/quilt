import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Pagination from 'components/Pagination2'
import * as BucketConfig from 'utils/BucketConfig'
import usePrevious from 'utils/usePrevious'

import Backlight from 'website/components/Backgrounds/Backlight1'
import BucketGrid from 'website/components/BucketGrid'

const PER_PAGE = 3

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  container: {
    paddingBottom: t.spacing(5),
    paddingTop: t.spacing(8),
    position: 'relative',
    zIndex: 1,
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    [t.breakpoints.down('xs')]: {
      alignItems: 'center',
      flexDirection: 'column-reverse',
      flexWrap: 'wrap',
    },
  },
  pgBtn: {
    background: fade(t.palette.secondary.main, 0),
    border: `1px solid ${t.palette.secondary.main}`,
    color: t.palette.secondary.main,
    '&:hover': {
      background: fade(t.palette.secondary.main, t.palette.action.hoverOpacity),
    },
    '&:not(:last-child)': {
      borderRight: 'none',
    },
  },
  pgCurrent: {
    color: t.palette.text.primary,
    background: t.palette.secondary.main,
    '&:hover': {
      background: t.palette.secondary.main,
    },
  },
}))

export default function Buckets() {
  const classes = useStyles()
  const buckets = BucketConfig.useRelevantBucketConfigs()
  const [page, setPage] = React.useState(1)
  const scrollRef = React.useRef(null)

  const pages = Math.ceil(buckets.length / PER_PAGE)

  const paginated = React.useMemo(
    () => (pages === 1 ? buckets : buckets.slice((page - 1) * PER_PAGE, page * PER_PAGE)),
    [buckets, page],
  )

  usePrevious(page, (prev) => {
    if (prev && page !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  if (!buckets.length) return null

  return (
    <div className={classes.root}>
      <Backlight style={{ opacity: 0.5 }} />
      <M.Container maxWidth="lg" className={classes.container}>
        <M.Typography variant="h1" color="textPrimary">
          Explore your buckets
        </M.Typography>
        <M.Box mt={4} />
        <BucketGrid buckets={paginated} ref={scrollRef} />
        <div className={classes.controls}>
          <M.Box mt={4}>
            <M.Button
              variant="contained"
              color="secondary"
              href="https://open.quiltdata.com/"
            >
              Browse Example Buckets
            </M.Button>
          </M.Box>
          {pages > 1 && (
            <Pagination
              {...{ pages, page, onChange: setPage }}
              mt={4}
              mb={0}
              classes={{ button: classes.pgBtn, current: classes.pgCurrent }}
            />
          )}
        </div>
      </M.Container>
    </div>
  )
}
