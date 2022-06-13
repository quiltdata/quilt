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

type NodeRenderer = (props: {
  expanded: boolean
  setExpanded: (exp: boolean) => void
}) => React.ReactNode

type NodeOrFn = NodeRenderer | React.ReactNode

interface SectionProps extends M.AccordionProps {
  icon?: string
  heading: NodeOrFn
  defaultExpanded?: boolean
  expandable?: boolean
  gutterBottom?: boolean
  gutterTop?: boolean
  extraSummary?: NodeOrFn
}

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
}: SectionProps) {
  const classes = useStyles()
  const [expandedState, setExpanded] = React.useState<boolean | null>(null)
  const expanded =
    !expandable || (expandedState != null ? expandedState : defaultExpanded)

  const onChange = React.useCallback(
    (_e: unknown, changedExpanded: boolean) => {
      setExpanded(changedExpanded)
    },
    [setExpanded],
  )

  const renderNodeOrFn = (nodeOrFn: NodeOrFn) =>
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
