import * as React from 'react'
import * as M from '@material-ui/core'

import * as FileEditor from 'components/FileEditor'
import Markdown from 'components/Markdown'
import Skel from 'components/Skeleton'

// TODO: Better error message
function NoValue() {
  return <h1>No value</h1>
}

// TODO: Better empty message
function NoPreview() {
  return <h1>No preview</h1>
}

const useSkeletonStyles = M.makeStyles((t) => ({
  line: {
    height: t.spacing(3),
    marginBottom: t.spacing(1),
  },
}))

// TODO: Move to ./Markdown
export function Skeleton() {
  const classes = useSkeletonStyles()
  const lines = [80, 50, 100, 60, 30, 80, 50, 100, 60, 30, 20, 70]
  return (
    <div>
      {lines.map((width, index) => (
        <Skel className={classes.line} width={`${width}%`} key={width + index} />
      ))}
    </div>
  )
}

export interface TextPreviewProps {
  type: FileEditor.EditorInputType
  value?: string
}

export default function TextPreview({ type, value }: TextPreviewProps) {
  if (!value) return <NoValue />

  switch (type.brace) {
    case 'markdown':
      // TODO: Use ./Markdown,
      // preview similar to Preview/renderers/Markdown with links, images etc.
      return <Markdown data={value} />
    default:
      return <NoPreview />
  }
}
