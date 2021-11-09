import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    border: `1px solid ${t.palette.grey[400]}`,
    borderWidth: '1px 1px 0',
    color: t.palette.text.hint,
    display: 'flex',
    padding: '4px 8px',
  },
}))

const useOverrideStyles = M.makeStyles({
  separator: {
    alignItems: 'center',
  },
  li: {
    '&::before': {
      position: 'absolute', // Workaround for sanitize.css a11y styles
    },
  },
})

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

interface CurrentBreadcrumbsItemProps {
  children: React.ReactNode
}

function CurrentBreadcrumbsItem({ children }: CurrentBreadcrumbsItemProps) {
  return <M.Typography variant="subtitle2">{children}</M.Typography>
}

function BreadcrumbsDivider() {
  return <M.Icon fontSize="small">chevron_right</M.Icon>
}

function shoudShowBreadcrumb(index: number, itemsNumber: number, tailOnly: boolean) {
  if (!tailOnly) return true
  return index > itemsNumber - 2
}

interface BreadcrumbsProps {
  tailOnly: boolean
  items: string[]
  onSelect: (path: string[]) => void
}

export default function Breadcrumbs({ tailOnly, items, onSelect }: BreadcrumbsProps) {
  const classes = useStyles()
  const overrideClasses = useOverrideStyles()

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

  return (
    <M.Breadcrumbs
      className={classes.root}
      classes={overrideClasses}
      ref={ref}
      separator={<BreadcrumbsDivider />}
    >
      {shoudShowBreadcrumb(0, items.length, tailOnly) && (
        <BreadcrumbsItem index={0} onClick={onBreadcrumb}>
          <M.Icon fontSize="small">home</M.Icon>
        </BreadcrumbsItem>
      )}

      {items.map((item, index) => {
        const actualIndex = index + 1

        if (!shoudShowBreadcrumb(actualIndex, items.length, tailOnly)) return null

        if (index === items.length - 1)
          return (
            <CurrentBreadcrumbsItem key="last-breadcrumb">{item}</CurrentBreadcrumbsItem>
          )

        return (
          <BreadcrumbsItem
            {...{
              key: `${item}_${actualIndex}`,
              index: actualIndex,
              onClick: onBreadcrumb,
            }}
          >
            {item}
          </BreadcrumbsItem>
        )
      })}
    </M.Breadcrumbs>
  )
}
