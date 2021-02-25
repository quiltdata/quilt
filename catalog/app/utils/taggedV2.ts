import * as R from 'ramda'

interface ValueConstructor<Input extends any[], Value> {
  (...args: Input): Value
}

export interface Instance<TypeTag, VariantTag = any, Value = any> {
  type: TypeTag
  variant: VariantTag
  value: Value
}

interface InstanceConstructor<
  TypeTag,
  VariantTag,
  Input extends any[],
  Value,
  Inst extends Instance<TypeTag, VariantTag, Value> = Instance<TypeTag, VariantTag, Value>
> {
  (...args: Input): Inst
  unbox(inst: Inst): Value
  is(inst: any): inst is Inst
}

interface Meta<TypeTag, VMap, CMap> {
  typeTag: TypeTag
  variants: VMap
  constructors: CMap
}

export type InstanceOf<T> = T extends { meta: Meta<infer TypeTag, infer VMap, any> }
  ? Instance<TypeTag, keyof VMap, VMap[keyof VMap]>
  : T extends InstanceConstructor<infer TypeTag, infer VariantTag, any, infer Value>
  ? Instance<TypeTag, VariantTag, Value>
  : never

export type ConstructorOf<T> = T extends { meta: Meta<any, any, infer CMap> }
  ? CMap[keyof CMap]
  : never

export type ValueOf<T> = T extends InstanceConstructor<any, any, any, infer Value>
  ? Value
  : never

const mkCons = <TypeTag>(typeTag: TypeTag) => <
  VConsMap extends Record<any, ValueConstructor<any, any>>,
  Variant extends keyof VConsMap
>(
  valueCons: VConsMap[Variant],
  variantTag: Variant,
) => {
  type Inst = Instance<TypeTag, Variant, ReturnType<typeof valueCons>>
  const cons = (...args: Parameters<typeof valueCons>): Inst => ({
    type: typeTag,
    variant: variantTag,
    value: valueCons(...args),
  })

  cons.unbox = (inst: Inst) => inst.value

  // TODO: support optional predicate arg?
  cons.is = (inst: any): inst is Inst =>
    !!inst && inst.type === typeTag && inst.variant === variantTag

  return cons
}

export function create<TypeTag, VConsMap extends Record<any, ValueConstructor<any, any>>>(
  typeTag: TypeTag,
  vConsMap: VConsMap,
) {
  type Constructors = {
    [VariantTag in keyof VConsMap]: InstanceConstructor<
      TypeTag,
      VariantTag,
      Parameters<VConsMap[VariantTag]>,
      ReturnType<VConsMap[VariantTag]>
    >
  }

  type Inst = Instance<TypeTag, keyof VConsMap, ReturnType<VConsMap[keyof VConsMap]>>

  type ValueMap = {
    [VariantTag in keyof VConsMap]: ReturnType<VConsMap[VariantTag]>
  }

  type MatchCasesExhaustive<Out, Extra extends any[]> = {
    [VariantTag in keyof ValueMap]: (value: ValueMap[VariantTag], ...args: Extra) => Out
  }

  type WildcardCase<Out, Extra extends any[]> = (inst: Inst, ...args: Extra) => Out

  type MatchCasesWildcard<Out, Extra extends any[]> = Partial<
    MatchCasesExhaustive<Out, Extra>
  > & {
    _: WildcardCase<Out, Extra>
  }

  type MatchCases<Out, Extra extends any[] = []> =
    | MatchCasesExhaustive<Out, Extra>
    | MatchCasesWildcard<Out, Extra>

  type BoundMatch<Out, Extra extends any[]> = (inst: Inst, ...args: Extra) => Out

  const constructors = R.mapObjIndexed(mkCons(typeTag), vConsMap) as Constructors

  const is = (inst: any): inst is Inst => !!inst && inst.type === typeTag

  // TODO: support non-instance match (__ case)?
  function match<Out, Extra extends any[] = []>(
    cases: MatchCases<Out, Extra>,
  ): BoundMatch<Out, Extra>
  function match<Out, Extra extends any[] = []>(
    cases: MatchCases<Out, Extra>,
    ...args: [Inst, ...Extra]
  ): Out
  function match<Out, Extra extends any[] = []>(
    cases: MatchCases<Out, Extra>,
    ...args: [] | [Inst, ...Extra]
  ) {
    const exec = (inst: Inst, ...extra: Extra) => {
      const c = cases[inst.variant]
      if (c) return c(inst.value, ...extra)
      const wild = cases._ as WildcardCase<Out, Extra>
      return wild(inst, ...extra)
    }

    return args.length ? exec(...(args as [Inst, ...Extra])) : exec
  }

  // TODO: mapCase
  // TODO: reducer

  const ret = { is, match, case: match, ...constructors }
  return ret as typeof ret & {
    meta: Meta<TypeTag, ValueMap, typeof constructors>
  }
}

/*
// examples
const FilesAction = create('FilesAction' as const, {
  Add: (v: { files: [File]; prefix: string }) => v,
  Delete: (path: string) => path,
  DeleteDir: (prefix: string) => prefix,
  Revert: (path: string) => path,
  RevertDir: (prefix: string) => prefix,
  Reset: () => {},
})

type FilesAction = InstanceOf<typeof FilesAction>

const fn1 = (fa: FilesAction, d: ReturnType<typeof FilesAction.Delete>) => [fa, d]

console.log('FilesAction', FilesAction)

const FilesAction2 = create('FilesAction2' as const, {
  Delete: (path: string) => path,
})

console.log('FilesAction2', FilesAction2)

const del = FilesAction.Delete('del path')
const rev = FilesAction.Revert('rev path')

console.log('del', del)

const del2 = FilesAction2.Delete('del BAD')

console.log('del2', del2)

const isDel = (inst: any) => {
  if (FilesAction.Delete.is(inst)) {
    console.log('inst is del', inst, FilesAction.Delete.unbox(inst))
  } else {
    console.log('inst isnt del', inst)
  }
}

isDel(del)
isDel(rev)
isDel(del2)

const eagerRes = FilesAction.match(
  {
    Add: ({ prefix }) => prefix,
    Delete: (p) => p,
    DeleteDir: (p) => p,
    Revert: (p) => p,
    RevertDir: (p) => p,
    Reset: () => '',
  },
  del,
)

console.log('del match', eagerRes)

const curried = FilesAction.match({
  Add: ({ prefix }) => prefix,
  Delete: (p) => p,
  DeleteDir: (p) => p,
  Revert: (p) => p,
  RevertDir: (p) => p,
  Reset: () => '',
})

console.log('del match curried', curried(del))
// @ts-expect-error
console.log('del match bad', curried(del2))

const wild = FilesAction.match({
  Add: ({ prefix }) => prefix,
  Delete: (p) => p,
  DeleteDir: (p) => p,
  Revert: (p) => p,
  // RevertDir: (p) => p,
  // Reset: () => '',
  _: (i) => {
    console.log('wildcard case', i)
    return 'wild'
  },
})

console.log('del match wild', wild(del))
*/
