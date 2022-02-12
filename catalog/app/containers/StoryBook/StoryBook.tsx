import * as React from 'react'

import Layout from 'components/Layout'

// import JsonEditorBook from './JsonEditor'
import NglBook from './Ngl'

export default function StoryBook() {
  return (
    <Layout
      pre={
        <>
          <NglBook url="s3://fiskus-sandbox-dev/structure.pdb" />
          <NglBook url="s3://fiskus-sandbox-dev/1crn.cif" />
          <NglBook url="s3://fiskus-sandbox-dev/1crn.pdb" />
        </>
      }
    />
  )
  // return <Layout pre={<JsonEditorBook />} />
}
