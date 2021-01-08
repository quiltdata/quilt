/* Redirect */
import * as React from 'react'

import redirect from 'utils/redirect'
import Working from 'components/Working'

export default ({ url }) => {
  React.useEffect(() => {
    redirect(url)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <Working />
}
