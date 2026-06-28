import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { S3SummarizeHandle } from 'utils/LogicalKeyResolver'
import cfg from 'constants/config'
import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'
import usePrevious from 'utils/usePrevious'

function useBlob(blob: Blob) {
  const url = React.useMemo(() => window.URL.createObjectURL(blob), [blob])
  React.useEffect(
    () => () => {
      window.URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}

type PdfType = 'pdf' | 'pptx'

interface LoadBlobArgs {
  sign: (handle: S3SummarizeHandle) => string
  handle: S3SummarizeHandle
  page: number
  firstPageBlob: Blob
  type: PdfType
}

async function loadBlob({ sign, handle, page, firstPageBlob, type }: LoadBlobArgs) {
  if (page === 1) return firstPageBlob
  try {
    const url = sign(handle)
    const search = mkSearch({
      url,
      input: type,
      size: 'w1024h768',
      page,
    })
    const r = await fetch(`${cfg.apiGatewayEndpoint}/thumbnail${search}`)
    if (r.status >= 400) {
      const text = await r.text()
      throw new HTTPError(r, text)
    }
    return await r.blob()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('error loading pdf preview')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    alignItems: 'center',
  },
  btn: {
    marginBottom: -12,
    marginTop: -12,
    [t.breakpoints.up('sm')]: {
      bottom: '50%',
      fontSize: 72,
      margin: 0,
      position: 'absolute',
    },
  },
  next: {
    right: 0,
  },
  prev: {
    left: 0,
  },
  controls: {
    display: 'flex',
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
  locked: {
    opacity: 0.5,
  },
  progress: {
    bottom: '50%',
    position: 'absolute',
  },
  error: {
    bottom: '50%',
    position: 'absolute',
    textAlign: 'center',
  },
}))

interface PdfEssential {
  handle: S3SummarizeHandle
  firstPageBlob: Blob
  pages: number
  type: PdfType
}

interface PdfProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

function Pdf(
  { handle, firstPageBlob, pages, type }: PdfEssential,
  { className, ...props }: PdfProps,
) {
  const sign = AWS.Signer.useS3Signer()
  const classes = useStyles()

  const [page, setPage] = React.useState(1)
  const [pageValue, setPageValue] = React.useState<number | string>(page)

  const data = Data.use(loadBlob, { sign, handle, page, firstPageBlob, type })

  const [blob, setBlob] = React.useState(firstPageBlob)

  usePrevious(data.result, (prevResult) => {
    if (!R.equals(data.result, prevResult)) {
      data.case({
        Ok: (b: Blob) => {
          setBlob(b)
        },
        _: () => {},
      })
    }
  })

  const src = useBlob(blob)

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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPageValue(e.target.value)
    },
    [setPageValue],
  )

  const commitPageChange = React.useCallback(
    (val: string) => {
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
    (e: React.FocusEvent<HTMLInputElement>) => {
      commitPageChange(e.target.value)
    },
    [commitPageChange],
  )

  const handleKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitPageChange((e.target as HTMLInputElement).value)
      }
      if (e.key === 'Escape') {
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [commitPageChange],
  )

  const isPending = AsyncResult.Pending.is(data.result)
  const isError = AsyncResult.Err.is(data.result)

  return (
    <div className={cx(className, classes.root)} {...props}>
      <img
        alt=""
        src={src}
        className={cx(classes.page, (isPending || isError) && classes.locked)}
      />
      {isPending && <M.CircularProgress size={96} className={classes.progress} />}
      {isError && (
        <div className={classes.error}>
          <M.Icon fontSize="large">error_outline</M.Icon>
          <M.Typography>Unable to load page {page}</M.Typography>
        </div>
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

export default (data: PdfEssential, props: PdfProps) => <Pdf {...data} {...props} />
