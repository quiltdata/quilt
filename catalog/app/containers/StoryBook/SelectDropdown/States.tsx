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
const noItems: string[] = []

const NoData = () => <M.Box px={2}>No data</M.Box>

export default function SelectDropdownBasic() {
  const classes = useStyles()
  const [value, setValue] = React.useState(items[0])
  return (
    <>
      <div className={classes.flex}>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          loading
        />
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          loading
        >
          <span className={classes.label}>This is a chosen </span>
        </SelectDropdown>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          loading
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
          loading
          disabled
        />
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          loading
          disabled
        >
          <span className={classes.label}>This is a chosen </span>
        </SelectDropdown>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          loading
          disabled
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
          disabled
        />
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          disabled
        >
          <span className={classes.label}>This is a chosen </span>
        </SelectDropdown>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          disabled
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
          disabled
        />
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          disabled
        >
          <span className={classes.label}>This is a chosen </span>
        </SelectDropdown>
        <SelectDropdown
          className={classes.select}
          options={items}
          value={value}
          onChange={setValue}
          disabled
        >
          <M.Icon className={classes.label} fontSize="small">
            build
          </M.Icon>
        </SelectDropdown>
      </div>
      <div className={classes.flex}>
        <SelectDropdown
          className={classes.select}
          options={noItems}
          value={''}
          onChange={setValue}
          emptySlot={<NoData />}
        />
        <SelectDropdown
          className={classes.select}
          options={noItems}
          value={''}
          onChange={setValue}
          emptySlot={<NoData />}
        >
          <span className={classes.label}>This is a chosen </span>
        </SelectDropdown>
        <SelectDropdown
          className={classes.select}
          options={noItems}
          value={''}
          onChange={setValue}
          emptySlot={<NoData />}
        >
          <M.Icon className={classes.label} fontSize="small">
            build
          </M.Icon>
        </SelectDropdown>
      </div>
    </>
  )
}
