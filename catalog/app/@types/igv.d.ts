declare module 'igv' {
  interface IgvBrowser {}

  interface IgvBrowserOptions {}

  export function createBrowser(
    el: HTMLElement,
    options: IgvBrowserOptions,
  ): Promise<IgvBrowser>

  export function removeBrowser(browser: IgvBrowser): void
}
