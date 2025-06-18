import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

function withoutOnDeleteWhen(condition: boolean, props: M.ChipProps) {
  return condition ? R.dissoc('onDelete', props) : props
}

const useStyles = M.makeStyles((t) => ({
  checkbox: {
    marginRight: t.spacing(1),
  },
  option: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  input: {
    background: t.palette.background.paper,
  },
}))

interface EnumFilterProps {
  extents: string[]
  onChange: (v: string[]) => void
  value: string[]
  selectAll?: string
}

interface EnumProps
  extends Omit<M.TextFieldProps, keyof EnumFilterProps>,
    EnumFilterProps {}

export default function Enum({
  selectAll,
  extents,
  value,
  onChange,
  disabled,
  ...props
}: EnumProps) {
  const classes = useStyles()
  const allExtents = React.useMemo(
    () => (selectAll ? [selectAll, ...extents] : extents),
    [extents, selectAll],
  )
  const handleChange = React.useCallback(
    (_event, newValue: string[]) => {
      if (!selectAll) {
        onChange(newValue)
        return
      }

      if (value.length && newValue.includes(selectAll)) {
        onChange([])
        return
      }
      onChange(newValue.filter((b) => b !== selectAll))
    },
    [onChange, selectAll, value],
  )
  return (
    <Lab.Autocomplete
      fullWidth
      multiple
      onChange={handleChange}
      options={allExtents}
      renderInput={(params) => (
        <M.TextField {...props} {...params} className={classes.input} size="small" />
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          // eslint-disable-next-line react/jsx-key
          <M.Chip
            label={option}
            {...withoutOnDeleteWhen(option === selectAll, getTagProps({ index }))}
          />
        ))
      }
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
            {option.trim() ? option : <i>Empty string</i>}
          </M.Typography>
        </>
      )}
      value={selectAll && !value.length ? [selectAll] : value}
      disabled={disabled}
    />
  )
}
