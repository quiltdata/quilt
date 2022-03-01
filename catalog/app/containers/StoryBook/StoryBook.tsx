import * as React from 'react'

import Layout from 'components/Layout'

import JsonEditorBook from './JsonEditor'

export default function StoryBook() {
  return <Layout pre={<JsonEditorBook />} />
}
