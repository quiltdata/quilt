interface LoadFileArgs {
  defaultRepresentation?: boolean
  ext: string
}

interface IDecompressorRegistry {
  get(ext: string): (input: string) => string
}

interface StageParams {
  backgroundColor: string
}

declare module 'ngl' {
  export class Stage {
    constructor(wrapper: HTMLDivElement, options: StageParams)
    handleResize(): void
    loadFile(blob: Blob, options: LoadFileArgs): Promise<void>
    dispose(): void
  }

  export const DecompressorRegistry: IDecompressorRegistry
}
