import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'

import 'utils/perspective-pollution'

import perspective from '@finos/perspective'
import type { Table } from '@finos/perspective'
import type { HTMLPerspectiveViewerElement } from '@finos/perspective-viewer'

export interface State {
  size: number | null
  toggleConfig: () => void
}

const worker = perspective.worker()

export function renderViewer(
  parentNode: HTMLElement,
  { className }: React.HTMLAttributes<HTMLDivElement>,
): HTMLPerspectiveViewerElement {
  const element = document.createElement('perspective-viewer')
  // NOTE: safari needs `.perspective-viewer-material` instead of custom tagName
  element.className = cx('perspective-viewer-material', className)
  parentNode.appendChild(element)
  return element
}

export async function renderTable(
  data: string | ArrayBuffer,
  viewer: HTMLPerspectiveViewerElement,
) {
  const table = await worker.table(data)
  viewer.load(table)
  return table
}

function usePerspective(
  container: HTMLDivElement | null,
  data: string | ArrayBuffer,
  attrs: React.HTMLAttributes<HTMLDivElement>,
  settings?: boolean,
) {
  const [state, setState] = React.useState<State | null>(null)

  React.useEffect(() => {
    // NOTE(@fiskus): if you want to refactor, don't try `useRef`, try something different
    let table: Table | null = null
    let viewer: HTMLPerspectiveViewerElement | null = null

    async function renderData() {
      if (!container) return

      viewer = renderViewer(container, attrs)
      table = await renderTable(data, viewer)

      if (settings) {
        await viewer.toggleConfig(true)
      }

      const size = await table.size()
      setState({
        size,
        toggleConfig: () => viewer?.toggleConfig(),
      })
      setState(R.assoc('size', size))
    }

    async function disposeTable() {
      viewer?.parentNode?.removeChild(viewer)
      await viewer?.delete()
      await table?.delete()
    }

    renderData()

    return () => {
      disposeTable()
    }
  }, [attrs, container, data, settings])

  return state
}

export const use = usePerspective
