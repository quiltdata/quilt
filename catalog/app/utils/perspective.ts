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
  const table = React.useRef<Table | null>(null)
  const viewer = React.useRef<HTMLPerspectiveViewerElement | null>(null)

  const toggleConfig = React.useCallback(
    () => viewer.current?.toggleConfig(),
    [viewer.current],
  )

  const [state, setState] = React.useState<State>({
    toggleConfig,
    size: null,
  })

  React.useEffect(() => {
    async function renderData() {
      if (!container) return

      viewer.current = renderViewer(container, attrs)
      table.current = await renderTable(data, viewer.current)

      if (settings) {
        await viewer.current.toggleConfig(true)
      }

      const size = await table.current.size()
      setState(R.assoc('size', size))
    }

    async function disposeTable() {
      viewer.current?.parentNode?.removeChild(viewer.current)
      await viewer.current?.delete()
      await table.current?.delete()
    }

    renderData()

    return () => {
      disposeTable()
    }
  }, [attrs, container, data, settings])

  return state
}

export const use = usePerspective
