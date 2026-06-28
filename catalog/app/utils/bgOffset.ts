export const BG_WIDTH = 1920

interface Options {
  width?: number
}

export default (o: number, { width = BG_WIDTH }: Options = {}) =>
  `calc(${o}px - (${width}px - 100vw) / 2)`
