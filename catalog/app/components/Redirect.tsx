import * as React from 'react'

import redirect from 'utils/redirect'
import Working from 'components/Working'

interface RedirectProps {
  url: string
}

export default function Redirect({ url }: RedirectProps) {
  React.useEffect(() => {
    redirect(url)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <Working />
}
