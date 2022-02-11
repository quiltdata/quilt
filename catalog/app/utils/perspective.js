import * as React from 'react'

import 'utils/perspective-pollution'

import perspective from '@finos/perspective'

const worker = perspective.worker()

export function renderViewer(parentNode, { className }) {
  const element = document.createElement('perspective-viewer')
  element.className = className
  parentNode.appendChild(element)
  return element
}

export async function renderTable(data, viewer) {
  const table = await worker.table(data)
  viewer.load(table)
  return table
}

function usePerspective(container, data, attrs) {
  React.useEffect(() => {
    let table, viewer

    async function fetchData() {
      if (!container) return

      viewer = renderViewer(container, attrs)
      table = await renderTable(data, viewer)
    }
    fetchData()

    return async () => {
      viewer?.parentNode?.removeChild(viewer)
      await viewer?.delete()
      await table?.delete()
    }
  }, [attrs, container, data])
}

export const use = usePerspective
