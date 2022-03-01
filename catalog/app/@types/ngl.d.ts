interface LoadFileArgs {
  defaultRepresentation?: boolean
  ext: string
}

interface IDecompressorRegistry {
  get(ext: string): (input: string) => string
}

declare module 'ngl' {
  export class Stage {
    constructor(wrapper: HTMLDivElement)
    handleResize(): void
    loadFile(blob: Blob, options: LoadFileArgs): Promise<void>
  }

  export const DecompressorRegistry: IDecompressorRegistry
}
