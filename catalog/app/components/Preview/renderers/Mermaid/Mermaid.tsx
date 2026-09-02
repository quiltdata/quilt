import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Placeholder from 'components/Placeholder'
import useId from 'utils/useId'

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

// Past its own 50k-char default mermaid silently swaps the source for a "text size
// exceeded" graph, which renders as if it were the diagram. Match the loader's fetch
// ceiling so anything that got fetched is drawn as itself or reported as an error.
const MAX_TEXT_SIZE = 1024 * 1024

type State =
  | { tag: 'pending' }
  | { tag: 'ok'; svg: string }
  | { tag: 'err'; error: Error }

export default function Mermaid({ contents, className, ...props }: MermaidProps) {
  const classes = useStyles()
  const t = M.useTheme()
  const [state, setState] = React.useState<State>({ tag: 'pending' })
  const id = `mermaid-preview-${useId()}`

  React.useEffect(() => {
    let stale = false
    // mermaid measures text by drawing into a temp node it appends to `document.body`,
    // then removes it -- but both its error paths throw first, so a diagram that fails
    // to parse strands that node, and its error graph, outside the preview pane.
    const dropTempNode = () => document.getElementById(`d${id}`)?.remove()
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
          maxTextSize: MAX_TEXT_SIZE,
        })
        const { svg } = await mermaid.render(id, contents)
        if (!stale) setState({ tag: 'ok', svg })
      } catch (e) {
        dropTempNode()
        if (stale) return
        setState({ tag: 'err', error: e instanceof Error ? e : new Error(String(e)) })
      }
    }
    render()
    return () => {
      stale = true
      dropTempNode()
    }
  }, [contents, id, t.typography.fontFamily])

  if (state.tag === 'err')
    return (
      <M.Box className={className} padding={2} {...props}>
        <M.Typography variant="body1" gutterBottom>
          Unable to render this diagram.
        </M.Typography>
        <M.Typography variant="caption" color="textSecondary">
          {state.error.message}
        </M.Typography>
      </M.Box>
    )

  if (state.tag === 'pending')
    return <Placeholder className={className} color="text.secondary" delay={0} />

  return (
    // props precedes dangerouslySetInnerHTML: quilt_summarize.json passes author-set
    // keys through here, and a `children` among them would otherwise replace the SVG.
    <div
      {...props}
      className={cx(classes.root, className)}
      // Rendered by mermaid's DOMPurify pass over the emitted SVG; securityLevel
      // 'strict' additionally refuses script and click directives in the source.
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  )
}
