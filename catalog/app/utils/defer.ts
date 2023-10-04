interface Resolver<T> {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

interface Deferred<T> {
  resolver: Resolver<T>
  promise: Promise<T>
}

export default function defer<T = unknown>() {
  let resolver: unknown
  const promise = new Promise<T>((resolve, reject) => {
    resolver = { resolve, reject }
  })
  return { resolver, promise } as Deferred<T>
}
