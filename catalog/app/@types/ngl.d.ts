interface LoadFileArgs {
  defaultRepresentation?: boolean
  ext: string
}

declare module 'ngl' {
  export class Stage {
    constructor(wrapper: HTMLDivElement)
    handleResize(): void
    loadFile(blob: Blob, options: LoadFileArgs): Promise<void>
  }
}
