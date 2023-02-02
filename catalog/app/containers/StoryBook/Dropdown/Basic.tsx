import * as React from 'react'
import * as M from '@material-ui/core'

import SelectDropdown from 'components/SelectDropdown'

const useStyles = M.makeStyles((t) => ({
  select: {
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  label: {
    marginRight: t.spacing(1),
    fontWeight: t.typography.fontWeightBold,
  },
  flex: {
    marginTop: t.spacing(2),
    display: 'flex',
  },
}))

const items = ['One', 'Two', 'Gazzilion of bazillions', 'Four']

// FIXME:
//   1. vertical align when wrapper is block and select has icon
//   2. in movile view select is empty
export default function DropdownBasic() {
  const classes = useStyles()
  const [value, setValue] = React.useState(items[0])
  return (
    <>
      <div>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
        />
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
        >
          <span className={classes.label}>This is a chosen </span>
        </SelectDropdown>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
        >
          <M.Icon className={classes.label} fontSize="small">
            build
          </M.Icon>
        </SelectDropdown>
      </div>
      <div className={classes.flex}>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
        />
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
        >
          <span className={classes.label}>This is a chosen </span>
        </SelectDropdown>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
        >
          <M.Icon className={classes.label} fontSize="small">
            build
          </M.Icon>
        </SelectDropdown>
      </div>
    </>
  )
}
