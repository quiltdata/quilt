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
  item: {
    display: 'flex',
  },
  divider: {
    marginLeft: t.spacing(0.5),
    marginRight: t.spacing(0.5),
  },
  back: {
    cursor: 'pointer',
    marginRight: t.spacing(2),
  },
}))

export default function Breadcrumbs({ items, onBack }) {
  const classes = useStyles()

  const ref = React.useRef()
  React.useEffect(() => {
    ref.current.scrollIntoView()
  }, [ref])

  return (
    <div className={classes.root} ref={ref}>
      <M.Icon className={classes.back} onClick={onBack}>
        arrow_back
      </M.Icon>

      {items.map((item, index) => {
        const key = `${item}_${index}`
        return (
          <div key={key} className={classes.item}>
            <M.Typography variant="subtitle2">{item}</M.Typography>
            {index !== items.length - 1 && (
              <M.Icon className={classes.divider} fontSize="small">
                chevron_right
              </M.Icon>
            )}
          </div>
        )
      })}
    </div>
  )
}
