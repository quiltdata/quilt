import * as React from 'react'

export default (init = null) => {
  const [current, claim] = React.useState(init)
  const release = React.useCallback((id) => claim((cur) => (id === cur ? null : cur)), [
    claim,
  ])
  return React.useMemo(() => ({ current, claim, release }), [current, claim, release])
}
