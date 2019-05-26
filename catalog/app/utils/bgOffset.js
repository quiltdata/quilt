export const BG_WIDTH = 1920

export default (o, { width = BG_WIDTH } = {}) => `calc(${o}px - (${width}px - 100vw) / 2)`
