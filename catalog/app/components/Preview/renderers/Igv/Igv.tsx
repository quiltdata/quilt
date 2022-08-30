import igv from 'igv'
import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'

const useStyles = M.makeStyles(() => ({
  root: {
    position: 'relative',
    zIndex: 1,
  },
}))

interface IgvEssential {
  options: igv.IgvBrowserOptions
}

export interface IgvProps extends React.HTMLProps<HTMLDivElement> {
  options: igv.IgvBrowserOptions
}

// XXX: consider using components/EChartsChart (may require some adjustments)
function Igv({ options, ...props }: IgvProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const classes = useStyles()

  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    let browser: igv.IgvBrowser
    async function initIgv() {
      if (!containerRef.current) return
      try {
        browser = await igv.createBrowser(containerRef.current, options)
        return () => browser && igv.removeBrowser(browser)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        if (e instanceof Error) {
          setError(e)
        } else {
          setError(new Error('Unexpected'))
        }
        // XXX: should NOT set state in dispose callback
        return () => setError(null)
      }
    }
    initIgv()
  }, [containerRef, options])

  if (error)
    return (
      <div key="igv-error">
        <M.Typography variant="h6" gutterBottom>
          Unexpected Error
        </M.Typography>
        <M.Typography variant="body1" gutterBottom>
          Something went wrong while loading preview
        </M.Typography>
        {error.message !== 'Unexpected' && (
          <M.Typography variant="body1" gutterBottom>
            <Code>{error.message}</Code>
          </M.Typography>
        )}
      </div>
    )

  return <div className={classes.root} ref={containerRef} {...props} />
}

export default ({ options }: IgvEssential, props: React.HTMLProps<HTMLDivElement>) => (
  <Igv options={options} {...props} />
)
