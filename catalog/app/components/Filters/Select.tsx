import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useStyles = M.makeStyles((t) => ({
  checkbox: {
    marginRight: t.spacing(1),
  },
  option: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  input: {
    paddingTop: '6px',
  },
}))

interface SelectFilterProps {
  extents: string[]
  onChange: (v: string) => void
  value: string | null
}

interface SelectProps
  extends Omit<M.TextFieldProps, keyof SelectFilterProps>,
    SelectFilterProps {}

export default function Select({ extents, value, onChange, ...props }: SelectProps) {
  const classes = useStyles()
  return (
    <Lab.Autocomplete
      fullWidth
      onChange={(event, newValue) => onChange(newValue as string)}
      options={extents}
      renderInput={(params) => (
        <M.TextField
          {...props}
          {...params}
          className={classes.input}
          placeholder="Select bucket"
          size="small"
        />
      )}
      renderOption={(option, { selected }) => (
        <>
          <M.Checkbox
            icon={<M.Icon>check_box_outline_blank</M.Icon>}
            checkedIcon={<M.Icon>check_box</M.Icon>}
            className={classes.checkbox}
            checked={selected}
            size="small"
          />
          <M.Typography className={classes.option} title={option} variant="body2">
            {option}
          </M.Typography>
        </>
      )}
      value={value}
    />
  )
}
