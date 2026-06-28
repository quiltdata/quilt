import 'highlight.js/styles/default.css'
import * as React from 'react'
import * as M from '@material-ui/core'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  text: {
    fontFamily: t.typography.monospace.fontFamily,
    overflow: 'auto',
    whiteSpace: 'pre',
  },
}))

interface TextProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  note?: string
  warnings?: string
}

function Text({ className, children, note, warnings, ...props }: TextProps) {
  const classes = useStyles()
  return (
    <div className={className} {...props}>
      {renderWarnings(warnings)}
      <div title={note} className={classes.text}>
        {children}
      </div>
    </div>
  )
}

const html = (contents: string) => (
  // eslint-disable-next-line react/no-danger
  <div dangerouslySetInnerHTML={{ __html: contents }} />
)

const Skip = () => <div>&hellip;</div>

interface TextEssential {
  highlighted: { head: string; tail: string }
  note?: string
  warnings?: string
}

export default (
  { highlighted: { head, tail }, note, warnings }: TextEssential,
  props: React.HTMLAttributes<HTMLDivElement>,
) => (
  <Text {...{ note, warnings }} {...props}>
    {html(head)}
    {!!tail && <Skip />}
    {!!tail && html(tail)}
  </Text>
)
