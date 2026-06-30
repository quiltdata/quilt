import cx from 'classnames'
import * as React from 'react'

import type { RegularTableElement } from 'regular-table'
import perspective from '@finos/perspective'
import type { Table } from '@finos/perspective'
import type {
  HTMLPerspectiveViewerElement,
  ViewerConfigUpdate,
} from '@finos/perspective-viewer'

import log from 'utils/Logging'
import { perspectiveReady, themes } from 'utils/perspective-pollution'

export interface State {
  rotateThemes: () => void
  size: number | null
  toggleConfig: () => void
}

// The union accepted by Perspective 3.x's Client.table(): the tabular-preview
// lambda feeds an Arrow IPC ArrayBuffer or a CSV string (Bucket/.../Tabular.tsx),
// and Athena query results feed an array of row records (Queries/Athena/Results.tsx).
export type PerspectiveInput =
  | string
  | ArrayBuffer
  | Record<string, unknown[]>
  | Record<string, unknown>[]

// perspective.worker() is async in 3.x (returns a Promise<Client>) and sources
// its client WASM SYNCHRONOUSLY at call time from the registered
// <perspective-viewer> custom element (customElements.get('perspective-viewer')
// .__wasm_module__). That element is registered only at the END of
// perspective_viewer.init_client()'s async chain, so worker() MUST run after
// `perspectiveReady` resolves — otherwise it samples no/foreign client engine
// and the Table is born in the wrong wasm memory, crashing viewer.load() with a
// WASM out-of-bounds. Gate the (single, cached) client creation on readiness.
let clientP: ReturnType<typeof perspective.worker> | null = null
const getClient = () => (clientP ??= perspectiveReady.then(() => perspective.worker()))

export function renderViewer(
  parentNode: HTMLElement,
  { className }: React.HTMLAttributes<HTMLDivElement>,
): HTMLPerspectiveViewerElement {
  const element = document.createElement('perspective-viewer')
  element.className = cx(className)
  parentNode.appendChild(element)
  return element
}

export async function renderTable(
  data: PerspectiveInput,
  viewer: HTMLPerspectiveViewerElement,
) {
  const client = await getClient()
  const table = await client.table(data)
  await viewer.load(table)
  return table
}

function usePerspective(
  container: HTMLDivElement | null,
  data: PerspectiveInput,
  attrs: React.HTMLAttributes<HTMLDivElement>,
  config?: ViewerConfigUpdate,
  onRender?: (tableEl: RegularTableElement) => void,
) {
  const [state, setState] = React.useState<State | Error | null>(null)

  React.useEffect(() => {
    // NOTE(@fiskus): if you want to refactor, don't try `useRef`, try something different
    let table: Table | null = null
    let viewer: HTMLPerspectiveViewerElement | null = null

    async function renderData() {
      if (!container) return

      try {
        viewer = renderViewer(container, attrs)
        table = await renderTable(data, viewer)
      } catch (e) {
        const error = e instanceof Error ? e : new Error((e as any).message || `${e}`)
        setState(error)
        log.error(error)
        return
      }

      const regularTable: RegularTableElement | null =
        viewer.querySelector('regular-table')
      if (onRender && regularTable?.addStyleListener) {
        onRender(regularTable)
        regularTable.addStyleListener(({ detail }) => onRender(detail))
      }

      if (config) {
        await viewer.restore(config)
      }

      const size = await table.size()
      setState({
        rotateThemes: async () => {
          const settings = await viewer?.save()
          const themeIndex = themes.findIndex((t) => t === settings?.theme)
          const theme =
            themeIndex === themes.length - 1 ? themes[0] : themes[themeIndex + 1]
          viewer?.restore({ theme } as ViewerConfigUpdate)
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
  }, [attrs, config, container, data, onRender])

  return state
}

export const use = usePerspective
