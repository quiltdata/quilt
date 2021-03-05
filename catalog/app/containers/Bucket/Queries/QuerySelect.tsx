import * as React from 'react'
import * as M from '@material-ui/core'

// import { docs } from 'constants/urls'
// import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

interface QuerySelectProps {
  className: string
  queries: requests.Query[]
  onChange: (value: requests.Query | null) => void
  value: requests.Query | null
}

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 1),
  },
  selectWrapper: {
    width: '100%',
  },
  select: {
    padding: t.spacing(1),
  },
}))

export default function QuerySelect({
  className,
  queries,
  onChange,
  value,
}: QuerySelectProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      onChange(queries.find((query) => query.key === event.target.value) || null)
    },
    [queries, onChange],
  )

  return (
    <div className={className}>
      <M.Typography className={classes.header} variant="body1">
        Select query
      </M.Typography>
      <M.Paper>
        <M.FormControl className={classes.selectWrapper}>
          <M.Select
            classes={{ root: classes.select }}
            disabled={!queries.length}
            labelId="query-select"
            onChange={handleChange}
            value={value ? value.key : 'none'}
          >
            <M.MenuItem disabled value="none">
              Custom
            </M.MenuItem>
            {queries.map((query) => (
              <M.MenuItem key={query.key} value={query.key}>
                {query.name}
              </M.MenuItem>
            ))}
          </M.Select>
        </M.FormControl>
      </M.Paper>
      <M.FormHelperText>
        {!queries.length && 'There are no saved queries. '}
        {/* <StyledLink href={`${docs}/advanced-usage/queries`} target="_blank">
          Refer to documentation
        </StyledLink>{' '}
        to edit or save new queries. */}
      </M.FormHelperText>
    </div>
  )
}
