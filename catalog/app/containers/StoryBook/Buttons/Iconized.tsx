import * as React from 'react'
import * as M from '@material-ui/core'

import ButtonIconized from 'components/ButtonIconized'

export default function ButtonsIconized() {
  const [rotate, setRotate] = React.useState(false)
  const handleClick = React.useCallback(() => setRotate((r) => !r), [])
  return (
    <M.Grid container spacing={4}>
      <M.Grid item xs={4}>
        <ButtonIconized
          icon="build"
          label="Push the button"
          onClick={handleClick}
          rotate={rotate}
        />
      </M.Grid>
      <M.Grid item xs={4}>
        <ButtonIconized
          icon="build"
          label="Push the button"
          onClick={handleClick}
          rotate={rotate}
          variant="contained"
        />
      </M.Grid>
      <M.Grid item xs={4}>
        <ButtonIconized
          icon="build"
          label="Push the button"
          onClick={handleClick}
          rotate={rotate}
          variant="text"
        />
      </M.Grid>
      <M.Grid item xs={4}>
        <ButtonIconized
          color="primary"
          icon="build"
          label="Push the button"
          onClick={handleClick}
          rotate={rotate}
        />
      </M.Grid>
      <M.Grid item xs={4}>
        <ButtonIconized
          color="primary"
          icon="build"
          label="Push the button"
          onClick={handleClick}
          rotate={rotate}
          variant="contained"
        />
      </M.Grid>
      <M.Grid item xs={4}>
        <ButtonIconized
          color="primary"
          icon="build"
          label="Push the button"
          onClick={handleClick}
          rotate={rotate}
          variant="text"
        />
      </M.Grid>
    </M.Grid>
  )
}
