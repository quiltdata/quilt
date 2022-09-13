import cx from 'classnames'
import * as React from 'react'

import perspective from '@finos/perspective'
import type { Table, TableData } from '@finos/perspective'
import type {
  HTMLPerspectiveViewerElement,
  PerspectiveViewerConfig,
} from '@finos/perspective-viewer'

import { themes } from 'utils/perspective-pollution'

export interface State {
  rotateThemes: () => void
  size: number | null
  toggleConfig: () => void
}

export type PerspectiveInput = TableData

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
  data: PerspectiveInput,
  viewer: HTMLPerspectiveViewerElement,
) {
  const table = await worker.table(data)
  await viewer.load(table)
  return table
}

function usePerspective(
  container: HTMLDivElement | null,
  data: PerspectiveInput,
  attrs: React.HTMLAttributes<HTMLDivElement>,
  config?: PerspectiveViewerConfig,
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

      if (config) {
        await viewer.restore(config)
      }

      const size = await table.size()
      setState({
        rotateThemes: async () => {
          const settings = await viewer?.save()
          // @ts-expect-error `PerspectiveViewerConfig` type doesn't have `theme`
          const themeIndex = themes.findIndex((t) => t === settings?.theme)
          const theme =
            themeIndex === themes.length - 1 ? themes[0] : themes[themeIndex + 1]
          viewer?.restore({ theme } as PerspectiveViewerConfig)
        },
        size,
        toggleConfig: () => viewer?.toggleConfig(),
      })
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
  }, [attrs, config, container, data])

  return state
}

export const use = usePerspective
