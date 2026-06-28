declare module 'katex/contrib/auto-render/auto-render' {
  interface RenderMathInElementOptions {
    delimiters?: { left: string; right: string; display: boolean }[]
  }
  const renderMathInElement: (
    el: HTMLElement,
    options?: RenderMathInElementOptions,
  ) => void
  export default renderMathInElement
}
