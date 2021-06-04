import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import PreviewValue from './PreviewValue'
import { JsonValue, EMPTY_VALUE, RowData } from './constants'
import { stringifyJSON } from './utils'

const useStyles = M.makeStyles((t) => ({
  root: {
    height: t.spacing(4),
    position: 'relative',
  },
  icon: {
    right: t.spacing(6),
  },
  select: {
    ...t.typography.body2,
    padding: t.spacing(0, 1),
    outline: `2px solid ${t.palette.primary.light}`,
  },
}))

interface EnumSelectProps {
  data: RowData
  value: JsonValue
  onChange: (value: JsonValue) => void
}

export default function EnumSelect({ data, value, onChange }: EnumSelectProps) {
  const classes = useStyles()

  if (!data?.valueSchema?.enum) throw new Error('This is not enum')

  const options = data.valueSchema!.enum!

  const [innerValue, setInnerValue] = React.useState(() =>
    value === EMPTY_VALUE ? '' : JSON.stringify(value),
  )

  return (
    <div className={classes.root}>
      <Lab.Autocomplete
        getOptionLabel={(option) => {
          if (option === EMPTY_VALUE) return ''
          if (typeof option === 'string') return option
          return stringifyJSON(option)
        }}
        className={classes.select}
        options={options}
        renderOption={(option) => <PreviewValue value={option} />}
        freeSolo
        inputValue={innerValue}
        onInputChange={(e, newValue) => setInnerValue(newValue)}
        value={value}
        onChange={(e, newValue) => newValue !== null && onChange(newValue)}
        renderInput={({ InputProps, inputProps, ...rest }) => (
          <M.TextField
            autoFocus
            {...rest}
            InputProps={{
              ...InputProps,
              disableUnderline: true,
            }}
            // eslint-disable-next-line react/jsx-no-duplicate-props
            inputProps={inputProps}
          />
        )}
      />
    </div>
  )
}
