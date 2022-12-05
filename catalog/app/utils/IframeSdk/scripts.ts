interface LibraryConfig {
  namespace?: boolean
  path?: string
  scripts?: Record<string, LibraryConfig>
  styles?: Record<string, LibraryConfig>
  version?: string
}

const emptyLibraryConfig: LibraryConfig = {}

type SupportedScriptsConfig = Record<string, LibraryConfig>

const SUPPORTED_SCRIPTS: SupportedScriptsConfig = {
  perspective: {
    namespace: true,
    scripts: {
      '@finos/perspective': emptyLibraryConfig,
      '@finos/perspective-viewer-d3fc': emptyLibraryConfig,
      '@finos/perspective-viewer-datagrid': emptyLibraryConfig,
      '@finos/perspective-workspace': emptyLibraryConfig,
    },
  },
  '@finos/perspective': {
    styles: {
      '@finos/perspective-workspace': {
        path: 'dist/css/material.css',
      },
    },
  },
  '@finos/perspective-viewer-d3fc': emptyLibraryConfig,
  '@finos/perspective-viewer-datagrid': emptyLibraryConfig,
  '@finos/perspective-workspace': emptyLibraryConfig,
  echarts: emptyLibraryConfig,
  igv: emptyLibraryConfig,
}

type LibraryName = keyof typeof SUPPORTED_SCRIPTS

type Result = { libraryName: string; version: string; path?: string }

function loadStyle(
  libraryName: LibraryName,
  version: string = 'latest',
  path?: string,
): Promise<Result> {
  return new Promise((resolve) => {
    const linkEl = document.createElement('link')
    linkEl.onload = () => resolve({ libraryName, version, path })
    linkEl.rel = 'stylesheet'

    const urlBase = 'https://cdn.jsdelivr.net/npm/'
    const urlVersion = `@${version || 'latest'}`
    const urlPath = path ? `/${path}` : ''
    linkEl.href = `${urlBase}${libraryName}${urlVersion}${urlPath}`

    const head = document.getElementsByTagName('head')[0]
    head.appendChild(linkEl)
  })
}

function loadScript(
  libraryName: LibraryName,
  version: string = 'latest',
): Promise<Result> {
  return new Promise((resolve) => {
    const scriptEl = document.createElement('script')
    scriptEl.onload = () => resolve({ libraryName, version })
    scriptEl.src = `https://cdn.jsdelivr.net/npm/${libraryName}@${version || 'latest'}`
    const head = document.getElementsByTagName('head')[0]
    head.appendChild(scriptEl)
  })
}

export async function install(
  libraryName: LibraryName,
  version?: string,
): Promise<Result[]> {
  const library = SUPPORTED_SCRIPTS[libraryName]

  if (!library) {
    return Promise.reject(new Error('This library is unsupported'))
  }

  let queue = library.namespace ? [] : [loadScript(libraryName, version)]

  if (library.scripts) {
    Object.entries(library.scripts).forEach(([name, config]) => {
      queue.push(loadScript(name, config.version))
    })
  }

  if (library.styles) {
    Object.entries(library.styles).map(([name, config]) => {
      queue.push(loadStyle(name, config.version, config.path))
    })
  }

  return Promise.all(queue)
}

export function list() {
  return Object.entries(SUPPORTED_SCRIPTS).map(([name, config]) => {
    const output: [string, string[]?] = [name]
    if (config.scripts) {
      output.push(
        Object.entries(config.scripts).map(([n, c]) => (c.path ? `${n}/${c.path}` : n)),
      )
    }
    if (config.styles) {
      output.push(
        Object.entries(config.styles).map(([n, c]) => (c.path ? `${n}/${c.path}` : n)),
      )
    }
    if (output.length === 1) return output[0]
    return output
  })
}
