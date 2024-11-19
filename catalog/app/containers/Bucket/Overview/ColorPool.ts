export interface ColorPool {
  get: (key: string) => string
}

export function makeColorPool(pool: string[]): ColorPool {
  const map: Record<string, string> = {}
  let poolIdx = 0
  const get = (key: string): string => {
    if (!(key in map)) {
      // eslint-disable-next-line no-plusplus
      map[key] = pool[poolIdx++ % pool.length]
    }
    return map[key]
  }
  return { get }
}
