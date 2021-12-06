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

      viewer = perspective.renderViewer(container, attrs)
      table = await perspective.renderTable(data, viewer)
    }
    fetchData()

    return () => {
      table?.delete()
      viewer?.parentNode?.removeChild(viewer)
    }
  }, [attrs, container, data])
}

export const use = usePerspective
