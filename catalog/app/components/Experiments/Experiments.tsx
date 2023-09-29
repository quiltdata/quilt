import * as React from 'react'

const EXPERIMENTS = {
  cta: [
    'Ready to get your data organized?',
    'Ready to experiment faster?',
    'Ready to maximize return on data?',
  ],
  lede: ['Accelerate from data to impact', 'Manage data like code', 'Discover faster'],
}

type Name = keyof typeof EXPERIMENTS

type Variants = (typeof EXPERIMENTS)[Name]

type SelectedVariants = Partial<Record<Name, Variants[0]>>

const Ctx = React.createContext<
  | {
      get: (n: Name) => Variants[0]
      getSelectedVariants: (p?: string) => Record<string, Variants[0]>
    }
  | undefined
>(undefined)

const pickRandom = (arr: Variants): Variants[0] =>
  arr[Math.floor(Math.random() * arr.length)]

const mapKeys = (variants: SelectedVariants, fn: (p: string, v: string) => string) =>
  Object.entries(variants).reduce(
    (memo, [k, v]) => ({
      ...memo,
      [fn(k, v)]: v,
    }),
    {} as Record<string, Variants[0]>,
  )

export function ExperimentsProvider({ children }: React.PropsWithChildren<{}>) {
  const ref = React.useRef<SelectedVariants>({})

  const get = React.useCallback(
    (name: Name) => {
      if (!(name in ref.current)) {
        ref.current[name] = pickRandom(EXPERIMENTS[name])
      }
      return ref.current[name]!
    },
    [ref],
  )

  const getSelectedVariants = React.useCallback(
    (prefix = '') => mapKeys(ref.current, (k) => `${prefix}${k}`),
    [ref],
  )

  return <Ctx.Provider value={{ get, getSelectedVariants }}>{children}</Ctx.Provider>
}

export function useExperiments(experiment: Name) {
  const exps = React.useContext(Ctx)
  return experiment ? exps?.get(experiment) : exps
}

export { ExperimentsProvider as Provider, useExperiments as use }
