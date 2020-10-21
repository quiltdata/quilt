import * as React from 'react'
import cx from 'classnames'

import * as M from '@material-ui/core'

const initialSchema = {
  type: 'object',
  properties: {
    num: {
      type: 'number',
    },
    more: {
      type: 'string',
      enum: ['one', 'two', 'three'],
    },
    user_meta: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        ppu: { type: 'number' },
        batters: {
          type: 'object',
          properties: {
            batter: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['id', 'type', 'name', 'ppu', 'batters'],
    },
    message: {
      type: 'string',
    },
    version: {
      type: 'string',
    },
  },
  required: ['version', 'message', 'user_meta'],
}

const invalidSchema = {
  type: 'object',
  properties: {
    a: {
      type: 'number',
    },
    b: {
      type: 'string',
    },
  },
  required: ['a', 'b', 'c', 'd'],
}

const useStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(24),
  },

  spinner: {
    flex: 'none',
    marginRight: t.spacing(3),
  },
}))

const i18nMsgs = {
  label: 'Select schema',
}

export default function SelectSchema({ className, onChange, value: initialValue }) {
  const classes = useStyles()

  const t = M.useTheme()

  const [value, setValue] = React.useState(initialValue || '')
  const [options, setOptions] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const timerId = React.useRef(null)

  const onLoad = React.useCallback(() => {
    const option1 = {
      schema: invalidSchema,
      slug: 'schema-1',
      title: 'Schema 1',
    }
    const option2 = {
      schema: initialSchema,
      slug: 'schema-2',
      title: 'Schema 2',
    }
    setOptions([option1, option2])

    selectOption(option2)

    setLoading(false)
  }, [selectOption])

  const selectOption = React.useCallback(
    (option) => {
      setValue(option.slug)
      onChange(option)
    },
    [onChange],
  )

  React.useEffect(() => {
    if (timerId.current) {
      return
    }
    timerId.current = setTimeout(onLoad, 2000)
  })

  return (
    <M.FormControl
      className={cx(classes.root, className)}
      size="small"
      variant="outlined"
    >
      <M.InputLabel id="schema-select">{i18nMsgs.label}</M.InputLabel>
      <M.Select
        disabled={loading}
        labelId="schema-select"
        value={value}
        endAdornment={
          loading && (
            <M.CircularProgress className={classes.spinner} size={t.spacing(2)} />
          )
        }
        // NOTE: some MUI bug, need to set this attribute for correct border otlining
        label={i18nMsgs.label}
      >
        {options.map((option) => (
          <M.MenuItem
            key={option.slug}
            value={option.slug}
            onClick={() => selectOption(option)}
          >
            {option.title}
          </M.MenuItem>
        ))}
      </M.Select>
    </M.FormControl>
  )
}
