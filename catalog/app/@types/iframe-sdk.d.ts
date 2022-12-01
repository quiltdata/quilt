interface Handle {
  bucket: string
  key: string
  version?: string
}

interface PartialHandle {
  bucket?: string
  key: string
}

interface QuiltSdk {
  listFiles: () => Promise<Handle[]>
  findFile: (h: PartialHandle) => Promise<JSON | ArrayBuffer | string | Response>
  fetchFile: (h: Handle) => Promise<JSON | ArrayBuffer | string | Response>
}

interface Window {
  counter: number
  quilt: QuiltSdk
}
