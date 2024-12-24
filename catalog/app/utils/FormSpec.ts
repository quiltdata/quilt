export type FormSpec<Obj extends {}> = {
  [K in keyof Obj]: (formValues: Record<string, unknown>) => Obj[K]
}

export type { FormSpec as default }
