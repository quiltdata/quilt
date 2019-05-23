import cx from 'classnames'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

const Text = RT.composeComponent(
  'Preview.renderers.Text',
  RC.setPropTypes({
    className: PT.string,
    children: PT.node,
  }),
  withStyles((t) => ({
    root: {
      fontFamily: t.typography.monospace.fontFamily,
      overflow: 'auto',
      whiteSpace: 'pre',
    },
  })),
  ({ classes, className, ...props }) => (
    <div className={cx(className, classes.root)} {...props} />
  ),
)

const html = (contents) => (
  // eslint-disable-next-line react/no-danger
  <div dangerouslySetInnerHTML={{ __html: contents }} />
)

const Skip = () => <div>&hellip;</div>

export default ({ highlighted: { head, tail } }, props) => (
  <Text {...props}>
    {html(head)}
    {!!tail && <Skip />}
    {!!tail && html(tail)}
  </Text>
)
