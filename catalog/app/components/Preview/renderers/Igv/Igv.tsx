import * as React from 'react'
import * as M from '@material-ui/core'
import igv from 'igv'

const useStyles = M.makeStyles({
  root: {
    height: '400px',
  },
})

interface IgvEssential {
  options: igv.IgvBrowserOptions
}

export interface IgvProps extends React.HTMLProps<HTMLDivElement> {
  options: igv.IgvBrowserOptions
}

// XXX: consider using components/EChartsChart (may require some adjustments)
function Igv({ options, ...props }: IgvProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const [error, setError] = React.useState<Error | null>(null)
  const classes = useStyles()

  React.useEffect(() => {
    async function initIgv() {
      if (!containerRef.current) return
      try {
        await igv.createBrowser(containerRef.current, options)
        // FIXME
        // return () => browser.removeBrowser(browser)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        if (e instanceof Error) setError(e)
        // XXX: should NOT set state in dispose callback
        // return () => setError(null)
      }
    }
    initIgv()
  }, [containerRef, options])

  if (error)
    return (
      <>
        <M.Typography variant="h6" gutterBottom>
          Unexpected Error
        </M.Typography>
        <M.Typography variant="body1" gutterBottom>
          Something went wrong while loading preview
        </M.Typography>
      </>
    )

  return <div ref={containerRef} className={classes.root} {...props} />
}

export default ({ options }: IgvEssential, props: React.HTMLProps<HTMLDivElement>) => (
  <Igv options={options} {...props} />
)
