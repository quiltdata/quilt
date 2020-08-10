import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import { mkSearch } from 'utils/NamedRoutes'

function useBlob(blob) {
  const url = React.useMemo(() => window.URL.createObjectURL(blob), [blob])
  React.useEffect(
    () => () => {
      window.URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}

const PdfCover = React.forwardRef(function PdfCover({ blob, ...props }, ref) {
  const src = useBlob(blob)
  return <img ref={ref} alt="" src={src} {...props} />
})

const PdfPage = React.forwardRef(function PdfPage(
  { page, handle, className, ...props },
  ref,
) {
  const [state, setState] = React.useState(AsyncResult.Init())

  const endpoint = Config.use().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()

  const url = React.useMemo(() => sign(handle), [handle])

  const search = mkSearch({
    url,
    input: 'pdf',
    output: 'raw',
    size: 'w1024h768',
    page,
  })

  const src = `${endpoint}/thumbnail${search}`

  const handleError = React.useCallback(() => {
    setState(AsyncResult.Err())
  }, [setState])

  const handleLoad = React.useCallback(() => {
    setState(AsyncResult.Ok())
  }, [setState])

  return (
    <div ref={ref} className={className}>
      <img alt="" src={src} onError={handleError} onLoad={handleLoad} {...props} />
      {AsyncResult.case(
        {
          Err: () => 'error',
          Ok: () => null,
          _: () => <M.CircularProgress />,
        },
        state,
      )}
    </div>
  )
})

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    alignItems: 'center',
    width: '100%',
  },
  btn: {
    fontSize: 72,
    position: 'absolute',
    bottom: '50%',
  },
  next: {
    right: 0,
  },
  prev: {
    left: 0,
  },
  controls: {
    marginTop: t.spacing(2),
  },
  pageInput: {
    marginLeft: 4,
    marginRight: 4,
  },
  pageInputInput: {
    height: 24,
    padding: 0,
    textAlign: 'center',
    width: 40,
  },
  page: {
    maxHeight: 'calc(100vh - 80px)',
    maxWidth: '100%',
  },
}))

function Pdf({ handle, firstPageBlob, pages }, props) {
  console.log('Pdf', { handle, firstPageBlob, pages, props })

  const classes = useStyles()

  const [page, setPage] = React.useState(1)
  const [pageValue, setPageValue] = React.useState(page)

  const next = React.useCallback(() => {
    if (page >= pages) return
    setPage(page + 1)
    setPageValue(page + 1)
  }, [setPage, setPageValue, page, pages])

  const prev = React.useCallback(() => {
    if (page <= 1) return
    setPage(page - 1)
    setPageValue(page - 1)
  }, [setPage, setPageValue, page])

  const handlePageChange = React.useCallback(
    (e) => {
      setPageValue(e.target.value)
    },
    [setPageValue],
  )

  const commitPageChange = React.useCallback(
    (val) => {
      const parsed = parseInt(val, 10)
      if (Number.isNaN(parsed) || parsed < 1) {
        setPageValue(page)
      } else if (parsed > pages) {
        setPage(pages)
        setPageValue(pages)
      } else {
        setPage(parsed)
        setPageValue(parsed)
      }
    },
    [setPage, setPageValue, page, pages],
  )

  const handleBlur = React.useCallback(
    (e) => {
      commitPageChange(e.target.value)
    },
    [commitPageChange],
  )

  const handleKey = React.useCallback(
    (e) => {
      if (e.key === 'Enter') {
        commitPageChange(e.target.value)
      }
      if (e.key === 'Escape') {
        e.target.blur()
      }
    },
    [commitPageChange],
  )

  return (
    <div className={classes.root}>
      {page === 1 ? (
        <PdfCover blob={firstPageBlob} className={classes.page} />
      ) : (
        // <PdfPage page={page} handle={handle} className={classes.page} />
        <PdfCover blob={firstPageBlob} className={classes.page} />
      )}
      <div className={classes.controls}>
        <M.IconButton
          onClick={prev}
          disabled={page <= 1}
          className={cx(classes.btn, classes.prev)}
        >
          <M.Icon fontSize="inherit">chevron_left</M.Icon>
        </M.IconButton>
        <M.Typography component="div">
          Page{' '}
          <M.OutlinedInput
            className={classes.pageInput}
            inputProps={{ className: classes.pageInputInput }}
            value={pageValue}
            onChange={handlePageChange}
            onBlur={handleBlur}
            onKeyDown={handleKey}
          />{' '}
          / {pages}
        </M.Typography>
        <M.IconButton
          onClick={next}
          disabled={page >= pages}
          className={cx(classes.btn, classes.next)}
        >
          <M.Icon fontSize="inherit">chevron_right</M.Icon>
        </M.IconButton>
      </div>
    </div>
  )
}

export default (data, props) => <Pdf {...data} {...props} />
