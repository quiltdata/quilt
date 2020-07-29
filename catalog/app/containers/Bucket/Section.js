import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import ButtonIcon from 'components/ButtonIcon'

const useStyles = M.makeStyles((t) => ({
  summaryExpanded: {},
  summaryRoot: {
    '&$summaryExpanded': {
      minHeight: 48,
    },
  },
  summaryContent: {
    '&$summaryExpanded': {
      margin: [[12, 0]],
    },
  },
  heading: {
    display: 'flex',
  },
  gutterBottom: {
    marginBottom: t.spacing(2),
  },
  gutterTop: {
    marginTop: t.spacing(2),
  },
}))

export default function Section({
  icon,
  heading,
  defaultExpanded = false,
  expandable = true,
  gutterBottom = false,
  gutterTop = false,
  extraSummary,
  children,
  ...props
}) {
  const classes = useStyles()
  const [expandedState, setExpanded] = React.useState(null)
  const expanded =
    !expandable || (expandedState != null ? expandedState : defaultExpanded)

  const onChange = React.useCallback(
    (e, changedExpanded) => {
      setExpanded(changedExpanded)
    },
    [setExpanded],
  )

  const renderNodeOrFn = (nodeOrFn) =>
    typeof nodeOrFn === 'function' ? nodeOrFn({ expanded, setExpanded }) : nodeOrFn

  return (
    <M.Accordion
      expanded={expanded}
      onChange={onChange}
      className={cx({
        [classes.gutterBottom]: gutterBottom,
        [classes.gutterTop]: gutterTop,
      })}
      {...props}
    >
      <M.AccordionSummary
        expandIcon={expandable && <M.Icon>expand_more</M.Icon>}
        classes={{
          expanded: classes.summaryExpanded,
          root: classes.summaryRoot,
          content: classes.summaryContent,
        }}
      >
        <M.Typography variant="button" className={classes.heading}>
          {!!icon && <ButtonIcon>{icon}</ButtonIcon>}
          {renderNodeOrFn(heading)}
        </M.Typography>
        {renderNodeOrFn(extraSummary)}
      </M.AccordionSummary>
      <M.AccordionDetails>{renderNodeOrFn(children)}</M.AccordionDetails>
    </M.Accordion>
  )
}
