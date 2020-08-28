import * as React from 'react'

import * as APIGateway from './APIGateway'

export const useES = () => {
  const req = APIGateway.use()
  return React.useCallback(
    ({ index = '*', action, query }) => req('/search', { index, action, query }),
    [req],
  )
}

export const use = useES
