import * as React from 'react'

import Error from 'components/Error'
import Layout from 'components/Layout'

export default function NotFoundPage() {
  return (
    <Layout>
      <Error headline="Nothing here" detail="Do you need to log in?" />
    </Layout>
  )
}
