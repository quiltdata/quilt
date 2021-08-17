import * as FP from 'fp-ts'

export default <VV = any>(fn: (key: string) => boolean) => <V extends VV>(
  r: Record<string, V>,
) => FP.record.filterWithIndex<string, V>((k) => !fn(k))(r)
