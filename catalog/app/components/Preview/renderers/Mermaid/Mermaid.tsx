import * as React from 'react'
import * as M from '@material-ui/core'

import Placeholder from 'components/Placeholder'

export interface MermaidProps extends React.HTMLAttributes<HTMLDivElement> {
  contents: string
}

const useStyles = M.makeStyles((t) => ({
  root: {
    overflowX: 'auto',
    padding: t.spacing(2),
    // The rendered graph is an SVG sized by mermaid; keep it from overflowing the
    // preview pane while leaving the diagram's own aspect ratio alone.
    '& svg': {
      height: 'auto',
      maxWidth: '100%',
    },
  },
}))

// mermaid.render() needs a DOM id to key its output by.
let idCounter = 0

export default function Mermaid({ contents, className, ...props }: MermaidProps) {
  const classes = useStyles()
  const t = M.useTheme()
  const [svg, setSvg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<Error | null>(null)
  const id = React.useMemo(() => `mermaid-preview-${(idCounter += 1)}`, [])

  React.useEffect(() => {
    let stale = false
    setError(null)
    async function render() {
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({
          startOnLoad: false,
          // Diagram source is customer data: keep mermaid's own sanitizer on and
          // refuse click-handler/script directives in the graph definition.
          securityLevel: 'strict',
          theme: 'neutral',
          fontFamily: t.typography.fontFamily,
        })
        const { svg: rendered } = await mermaid.render(id, contents)
        if (!stale) setSvg(rendered)
      } catch (e) {
        if (stale) return
        setSvg(null)
        setError(e instanceof Error ? e : new Error(String(e)))
      }
    }
    render()
    return () => {
      stale = true
    }
  }, [contents, id, t.typography.fontFamily])

  if (error)
    return (
      <M.Box padding={2}>
        <M.Typography variant="body1" gutterBottom>
          Unable to render this diagram.
        </M.Typography>
        <M.Typography variant="caption" color="textSecondary">
          {error.message}
        </M.Typography>
      </M.Box>
    )

  if (svg === null) return <Placeholder color="text.secondary" />

  return (
    <div
      className={className ? `${classes.root} ${className}` : classes.root}
      // Rendered by mermaid under securityLevel: 'strict', which sanitizes the SVG.
      dangerouslySetInnerHTML={{ __html: svg }}
      {...props}
    />
  )
}
