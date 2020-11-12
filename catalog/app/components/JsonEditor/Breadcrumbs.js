import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    border: `1px solid ${t.palette.grey[400]}`,
    borderWidth: '1px 1px 0',
    display: 'flex',
    height: t.spacing(4) + 1,
    padding: t.spacing(0, 1),
    color: t.palette.text.hint,
  },
  objectRoot: {
    marginRight: t.spacing(0.5),
  },
}))

const useItemStyles = M.makeStyles(() => ({
  root: {
    cursor: 'pointer',
    display: 'flex',
  },
}))

function BreadcrumbsItem({ index, children, onClick }) {
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

export default function Breadcrumbs({ items, onSelect }) {
  const classes = useStyles()

  const onBreadcrumb = React.useCallback(
    (index) => {
      if (index === items.length + 1) return
      const path = items.slice(0, index)
      onSelect(path)
    },
    [items, onSelect],
  )

  const ref = React.useRef()
  React.useEffect(() => {
    ref.current.scrollIntoView()
  }, [ref])

  return (
    <M.Breadcrumbs className={classes.root} ref={ref} separator={<BreadcrumbsDivider />}>
      <BreadcrumbsItem
        className={classes.objectRoot}
        index={0}
        item="#"
        color="inherit"
        onClick={onBreadcrumb}
      >
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
