import invariant from 'invariant'

export interface Leaf<T> {
  readonly _tag: 'Leaf'
  value: T
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export function Leaf<T>(value: T): Leaf<T> {
  return { _tag: 'Leaf', value }
}

export interface Tree<T, K> {
  readonly _tag: 'Tree'
  children: Map<K, Node<T, K>>
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export function Tree<T, K>(children: Iterable<[K, Node<T, K>]>): Tree<T, K> {
  return { _tag: 'Tree', children: new Map(children) }
}

export type Node<T, K> = Tree<T, K> | Leaf<T>

export function at<T, K>(tree: Tree<T, K>, path: K[]): Node<T, K> | undefined {
  invariant(path.length > 0, 'Path must not be empty')
  const [head, ...tail] = path
  const child = tree.children.get(head)
  if (!child) return undefined
  if (tail.length === 0) return child
  if (child._tag === 'Leaf') return undefined
  return at(child, tail)
}

export function Pair<A, B>(a: A, b: B): [A, B] {
  return [a, b]
}

export function fromLeaf<T, K>(path: K[], leaf: Leaf<T>): Tree<T, K> {
  invariant(path.length > 0, 'Path must not be empty')
  const [head, ...tail] = path
  const child = tail.length === 0 ? leaf : fromLeaf(tail, leaf)
  return Tree([Pair(head, child)])
}

export type ConflictResolver<T, K> = (
  existing: Node<T, K>,
  conflict: Node<T, K>,
) => Node<T, K>

export function merge<T, K>(
  a: Tree<T, K>,
  b: Tree<T, K>,
  resolve: ConflictResolver<T, K>,
): Tree<T, K> {
  const children = new Map(a.children)
  b.children.forEach((node, path) => {
    const existing = children.get(path)
    children.set(path, existing ? resolve(existing, node) : node)
  })
  return Tree(children)
}
