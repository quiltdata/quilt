import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    border: `1px solid ${t.palette.grey[400]}`,
    borderWidth: '1px 1px 0 1px',
    display: 'flex',
    height: '49px',
    padding: t.spacing(1),
  },
  back: {
    cursor: 'pointer',
    marginRight: t.spacing(2),
  },
}))

const useItemStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
  },
  link: {
    cursor: 'pointer',
  },
  divider: {
    margin: t.spacing(0, 0.5),
  },
}))

function BreadcrumbsItem({ index, item, last, onClick }) {
  const classes = useItemStyles()

  return (
    <div className={classes.root}>
      <M.Link
        onClick={React.useCallback(() => onClick(index), [onClick, index])}
        className={classes.link}
        variant="subtitle2"
      >
        {item}
      </M.Link>
      {!last && (
        <M.Icon className={classes.divider} fontSize="small">
          chevron_right
        </M.Icon>
      )}
    </div>
  )
}

export default function Breadcrumbs({ items, onSelect }) {
  const classes = useStyles()

  const onBack = React.useCallback(() => {
    onSelect(R.init(items))
  }, [items, onSelect])

  const onBreadcrumb = React.useCallback(
    (index) => {
      if (index === items.length) return
      const path = items.slice(0, index + 1)
      onSelect(path)
    },
    [items, onSelect],
  )

  const ref = React.useRef()
  React.useEffect(() => {
    ref.current.scrollIntoView()
  }, [ref])

  return (
    <div className={classes.root} ref={ref}>
      <M.Icon className={classes.back} onClick={onBack}>
        arrow_back
      </M.Icon>

      {items.map((item, index) => (
        <BreadcrumbsItem
          {...{
            key: `${item}_${index}`,
            index,
            item,
            last: index === items.length - 1,
            onClick: onBreadcrumb,
          }}
        />
      ))}
    </div>
  )
}
