import * as React from 'react'

import * as M from '@material-ui/core'

import Delay from 'utils/Delay'

export default function SubmitSpinner({ children, value }) {
  return (
    <Delay ms={200} alwaysRender>
      {(ready) => (
        <M.Fade in={ready}>
          <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
            <M.CircularProgress
              size={24}
              variant={value < 100 ? 'determinate' : 'indeterminate'}
              value={value < 100 ? value * 0.9 : undefined}
            />
            <M.Box pl={1} />
            <M.Typography variant="body2" color="textSecondary">
              {children}
            </M.Typography>
          </M.Box>
        </M.Fade>
      )}
    </Delay>
  )
}
