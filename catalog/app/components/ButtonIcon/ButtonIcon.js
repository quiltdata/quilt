import cx from 'classnames'
import PT from 'prop-types'
import * as RC from 'recompose'
import Icon from '@material-ui/core/Icon'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

export default RT.composeComponent(
  'ButtonIcon',
  RC.setPropTypes({
    position: PT.oneOf(['left', 'right']),
  }),
  withStyles(({ spacing: { unit } }) => ({
    left: {
      marginRight: unit,
    },
    right: {
      marginLeft: unit,
    },
  })),
  RC.mapProps(({ classes, className, position = 'left', ...props }) => ({
    ...props,
    className: cx(className, classes[position]),
  })),
  Icon,
)
