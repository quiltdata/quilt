import cx from 'classnames'
import 'highlight.js/styles/default.css'
import * as React from 'react'
import * as M from '@material-ui/core'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  text: {
    fontFamily: t.typography.monospace.fontFamily,
    overflow: 'auto',
    whiteSpace: 'pre',
  },
}))

function Text({ className, children, note, warnings, ...props }) {
  const classes = useStyles()
  return (
    <div className={cx(className, classes.root)} {...props}>
      {renderWarnings(warnings)}
      <div title={note} className={classes.text}>
        {children}
      </div>
    </div>
  )
}

const html = (contents) => (
  // eslint-disable-next-line react/no-danger
  <div dangerouslySetInnerHTML={{ __html: contents }} />
)

const Skip = () => <div>&hellip;</div>

export default ({ highlighted: { head, tail }, note, warnings }, props) => (
  <Text {...{ note, warnings }} {...props}>
    {html(head)}
    {!!tail && <Skip />}
    {!!tail && html(tail)}
  </Text>
)
