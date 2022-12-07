interface Handle {
  bucket: string
  key: string
  version?: string
}

interface PartialHandle {
  bucket?: string
  key: string
}

interface Env {
  fileHandle: Handle
  packageHandle: {
    bucket: string
    name: string
  }
}

interface QuiltSdk {
  env: Env
  listFiles: () => Promise<Handle[]>
  findFile: (h: PartialHandle) => Promise<JSON | ArrayBuffer | string | Response>
  fetchFile: (h: Handle) => Promise<JSON | ArrayBuffer | string | Response>
  scripts: {
    install: (
      name: string,
      version?: string,
    ) => Promise<{ libraryName: string; version: string; path?: string }[]>
  }
  signer: {
    url: (u: string) => Promise<string>
    igv: (object: {}) => Promise<{}>
  }
}

interface Window {
  quilt: QuiltSdk
}
