import * as React from 'react'

import Layout from 'components/Layout'

import Exchange from './Exchange'
import NewProduct from './NewProduct'

/**
 * The two workspace-level product screens, each wrapped in the app layout.
 *
 * Separate default-exported components rather than one router: `App` already owns
 * the route table, and a second router here would put the paths in two places.
 */
export function ExchangeScreen() {
  return <Layout pre={<Exchange />} />
}

export function NewProductScreen() {
  return <Layout pre={<NewProduct />} />
}

export default ExchangeScreen
