import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    border: `1px solid ${t.palette.grey[400]}`,
    borderWidth: '1px 1px 0',
    color: t.palette.text.hint,
    display: 'flex',
    padding: '5px 8px',
  },
  li: {
    '&::before': {
      position: 'absolute', // Workaround for sanitize.css a11y styles
    },
  },
}))

const useItemStyles = M.makeStyles({
  root: {
    cursor: 'pointer',
    display: 'flex',
  },
})

interface BreadcrumbsItemProps {
  index: number
  children: React.ReactNode
  onClick: (index: number) => void
}

function BreadcrumbsItem({ index, children, onClick }: BreadcrumbsItemProps) {
  const classes = useItemStyles()

  return (
    <M.Link
      onClick={React.useCallback(() => onClick(index), [onClick, index])}
      className={classes.root}
      variant="subtitle2"
    >
      {children}
    </M.Link>
  )
}

function BreadcrumbsDivider() {
  return <M.Icon fontSize="small">chevron_right</M.Icon>
}

interface BreadcrumbsProps {
  items: string[]
  onSelect: (path: string[]) => void
}

export default function Breadcrumbs({ items, onSelect }: BreadcrumbsProps) {
  const classes = useStyles()

  const onBreadcrumb = React.useCallback(
    (index) => {
      if (index === items.length + 1) return
      const path = items.slice(0, index)
      onSelect(path)
    },
    [items, onSelect],
  )

  const ref = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    ref.current?.scrollIntoView()
  }, [ref])

  const overrideClasses = React.useMemo(() => ({ li: classes.li }), [classes])

  return (
    <M.Breadcrumbs
      className={classes.root}
      classes={overrideClasses}
      ref={ref}
      separator={<BreadcrumbsDivider />}
    >
      <BreadcrumbsItem index={0} onClick={onBreadcrumb}>
        <M.Icon fontSize="small">home</M.Icon>
      </BreadcrumbsItem>

      {items.map((item, index) =>
        index === items.length - 1 ? (
          <M.Typography key="last-breadcrumb" variant="subtitle2">
            {item}
          </M.Typography>
        ) : (
          <BreadcrumbsItem
            {...{
              key: `${item}_${index}`,
              index: index + 1,
              onClick: onBreadcrumb,
            }}
          >
            {item}
          </BreadcrumbsItem>
        ),
      )}
    </M.Breadcrumbs>
  )
}
