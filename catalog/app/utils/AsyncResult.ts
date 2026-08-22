import { Data } from 'effect'

/**
 * AsyncResult — a 4-state async data machine, effect-backed.
 *
 *   Init → Pending → (Ok | Err)
 *
 * This replaces the legacy dynamic tagged-union factory (`utils/tagged`). Each
 * variant is an `effect/Data.TaggedClass`, so instances get structural equality
 * (`Equal.equals`) and hashing for free — which is what the `R.equals`-based
 * cache/dispatch comparisons in `utils/Data` and `utils/ResourceCache` rely on.
 *
 * Design goals (in priority order):
 *   1. Clarity + optionality: a compiler-inferred, generic model that is
 *      pleasant to consume from a React codebase.
 *   2. Preserve the two load-bearing ergonomics of the legacy API:
 *        - Constructors are plain callable references (`Ok`, `Err`, `Init`,
 *          `Pending`) so `promise.then(AsyncResult.Ok)` keeps working.
 *        - `match`/`case` hands the UNBOXED payload to named-variant handlers
 *          and the RAW instance to the `_`/`__` fallback.
 *   3. A rich combinator set (map / mapErr / flatMap / getOrElse / fold / …).
 *
 * The error is modelled as a *payload* on the `Err` variant, NOT as a typed E
 * channel like `Either`/`Exit`. In this codebase the error is usually a
 * `PreviewError` data instance, and consumers pattern-match on it, so keeping it
 * a first-class variant (rather than a short-circuiting failure channel) is the
 * right shape.
 */

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/** Not started / idle. Nullary. */
export class Init extends Data.TaggedClass('AsyncResult/Init')<{
  // `value` is kept (as `undefined`) on every variant so that legacy consumers
  // that reach for `.value` on a fallback-matched instance keep type-checking.
  readonly value: undefined
}> {}

/**
 * In flight. Optionally boxes a *previous* result so a stale `Ok` can survive
 * across refetches. The payload is intentionally `unknown`-ish: in `utils/Data`
 * it is a `{ request, params, prev }` record, elsewhere it is a nested
 * `AsyncResult` (or nothing). `prevResult` knows how to walk it.
 */
export class Pending<A = unknown, E = unknown> extends Data.TaggedClass(
  'AsyncResult/Pending',
)<{
  readonly value: PendingPrev<A, E> | undefined
}> {}

/** Success. */
export class Ok<A = unknown> extends Data.TaggedClass('AsyncResult/Ok')<{
  readonly value: A
}> {}

/** Failure. The error is a data payload, not a typed failure channel. */
export class Err<E = unknown> extends Data.TaggedClass('AsyncResult/Err')<{
  readonly value: E
}> {}

/**
 * The optional payload a `Pending` may carry. Either a nested `AsyncResult`, or
 * a `{ prev }` record (the `{ request, params, prev }` shape used by
 * `utils/Data` to remember the in-flight request identity alongside the stale
 * result), or nothing. The record form allows extra fields.
 */
export type PendingPrev<A = unknown, E = unknown> =
  | AsyncResult<A, E>
  | ({ readonly prev?: AsyncResult<A, E> | undefined } & Record<string, unknown>)

/**
 * `AsyncResult<A, E>` — the union of the four variants.
 * `A` = success payload, `E` = error payload (defaults to `Error`).
 */
export type AsyncResult<A = unknown, E = unknown> = Init | Pending<A, E> | Ok<A> | Err<E>

// ---------------------------------------------------------------------------
// Constructors (bare callable references — safe to pass to `.then`, `R.pipe`)
// ---------------------------------------------------------------------------

// These are thin wrappers rather than the raw classes so they can be passed
// point-free as unary functions: `promise.then(Ok).catch(Err)`. Passing a class
// by reference to `.then` would call it without `new` and throw.
//
// Constructors are typed to return the *widened* `AsyncResult<A, E>` union, not
// the narrow variant class. This is deliberate: it matches how a state-machine
// value is used (`React.useState(AsyncResult.Pending())` then later
// `setState(AsyncResult.Ok(v))` must type-check), mirrors `Option.some(x):
// Option<A>`, and keeps consumers off the concrete variant classes. Use the
// `.is*` refinements to narrow. The concrete classes are still exported for the
// rare `instanceof`/precise-type need.

/** `Ok(value)` — wrap a success value. Unary; safe as a `.then` callback. */
export const ok = <A, E = never>(value: A): AsyncResult<A, E> => new Ok({ value })

/** `Err(error)` — wrap a failure value. Unary; safe as a `.catch` callback. */
export const err = <E, A = never>(value: E): AsyncResult<A, E> => new Err({ value })

/** `Init()` — the idle sentinel. Nullary. */
export const init = <A = never, E = never>(): AsyncResult<A, E> =>
  new Init({ value: undefined })

/** `Pending(prev?)` — in flight, optionally boxing a previous result/record. */
export const pending = <A = unknown, E = unknown>(
  prev?: PendingPrev<A, E>,
): AsyncResult<A, E> => new Pending({ value: prev })

// ---------------------------------------------------------------------------
// Refinements
// ---------------------------------------------------------------------------

export const isInit = (r: unknown): r is Init => r instanceof Init
export const isPending = <A, E>(r: AsyncResult<A, E> | unknown): r is Pending<A, E> =>
  r instanceof Pending
export const isOk = <A>(r: AsyncResult<A, unknown> | unknown): r is Ok<A> =>
  r instanceof Ok
export const isErr = <E>(r: AsyncResult<unknown, E> | unknown): r is Err<E> =>
  r instanceof Err

/** True for any AsyncResult instance. */
export const is = (r: unknown): r is AsyncResult<unknown, unknown> =>
  isInit(r) || isPending(r) || isOk(r) || isErr(r)

// ---------------------------------------------------------------------------
// Matching — the friendly, hand-built matcher.
// ---------------------------------------------------------------------------

/**
 * Handler map for {@link match}/{@link caseCompat}.
 *
 * Named-variant handlers receive the UNBOXED payload plus any trailing args
 * forwarded to the matcher. The `_` / `__` fallbacks receive the RAW instance
 * (this asymmetry is deliberately preserved from the legacy API — several call
 * sites read `x.value` / call `Err.is(x)` inside `_`).
 *
 * The return type is *not* pinned to a single `R`: each handler declares its
 * own return type and {@link match} infers the result as the UNION of the
 * handlers that are actually present (so `{ Ok: () => T[], _: () => T }` yields
 * `T[] | T`, not an error). Exhaustiveness — every named variant, or a `_`/`__`
 * fallback — is checked at runtime by {@link runCase}.
 */
export interface Cases {
  Init?: (...extra: any[]) => unknown
  Pending?: (prev: any, ...extra: any[]) => unknown
  Ok?: (value: any, ...extra: any[]) => unknown
  Err?: (error: any, ...extra: any[]) => unknown
  /** Fallback for unmatched variants. Receives the RAW instance. */
  _?: (r: any, ...extra: any[]) => unknown
  /** Fallback that also matches a non-AsyncResult / missing instance. */
  __?: (r: any, ...extra: any[]) => unknown
}

/** The union of the return types of whichever handlers a `Cases` provides. */
export type CaseResult<C extends Cases> = {
  [K in keyof C]: C[K] extends (...args: any[]) => infer R ? R : never
}[keyof C]

// Recover the AsyncResult payload/error types the `cases` object was written
// against, so the curried matcher accepts the right instance. Handler *param
// annotations* (`Ok: (v: T) => …`) drive this — contextual inference can't,
// because in the curried form there is no `inst` to infer from.
type OkArg<C extends Cases> = C extends { Ok: (value: infer A, ...r: any[]) => any }
  ? A
  : unknown
type ErrArg<C extends Cases> = C extends { Err: (error: infer E, ...r: any[]) => any }
  ? E
  : unknown
/**
 * Trailing args a matcher forwards to its handlers, recovered from whichever
 * handler annotates them (checked in order: Ok, Err, Pending, _). This lets
 * render-prop sites inject `{ fetch }` / retry via any variant handler.
 */
type ExtraArgs<C extends Cases> = C extends {
  Ok: (value: any, ...extra: infer X) => any
}
  ? X
  : C extends { Err: (error: any, ...extra: infer X) => any }
    ? X
    : C extends { Pending: (prev: any, ...extra: infer X) => any }
      ? X
      : C extends { _: (r: any, ...extra: infer X) => any }
        ? X
        : []

const runCase = (cases: Cases, inst: unknown, extra: any[]): any => {
  if (isOk(inst) && cases.Ok) return cases.Ok(inst.value, ...extra)
  if (isErr(inst) && cases.Err) return cases.Err(inst.value, ...extra)
  if (isPending(inst) && cases.Pending) return cases.Pending(inst.value, ...extra)
  if (isInit(inst) && cases.Init) return cases.Init(...extra)
  const fallback = cases._ ?? cases.__
  if (fallback) return fallback(inst as AsyncResult<any, any>, ...extra)
  throw new Error(
    `AsyncResult.match: non-exhaustive cases for variant ${
      is(inst) ? inst._tag : String(inst)
    }`,
  )
}

/**
 * Pattern-match on an AsyncResult. Curried and eager in one function:
 *
 *   match(cases)               // → (inst, ...extra) => R   (reusable matcher)
 *   match(cases, inst)         // → R                       (eager)
 *   match(cases, inst, ...extra)
 *
 * Named handlers get the unboxed payload; `_`/`__` get the raw instance; any
 * trailing args are forwarded to the chosen handler (used by render-prop call
 * sites that inject `{ fetch }` / retry). `R` is the union of the provided
 * handlers' return types; the accepted instance / extra args are recovered from
 * the handler parameter annotations.
 */
export function match<const C extends Cases>(
  cases: C,
): (inst: AsyncResult<OkArg<C>, ErrArg<C>>, ...extra: ExtraArgs<C>) => CaseResult<C>
export function match<const C extends Cases>(
  cases: C,
  inst: AsyncResult<OkArg<C>, ErrArg<C>>,
  ...extra: ExtraArgs<C>
): CaseResult<C>
export function match(cases: Cases, ...applied: any[]): unknown {
  const matcher = (inst: unknown, ...extra: any[]): unknown => runCase(cases, inst, extra)
  if (applied.length === 0) return matcher
  const [inst, ...extra] = applied
  return matcher(inst, ...extra)
}

/**
 * `caseCompat` — the LEGACY-COMPAT matcher, exposed as `AsyncResult.case`.
 *
 * Identical runtime behaviour to {@link match}, but deliberately typed loosely
 * (`any` in, `any` out). This is the compatibility surface for the ~38 call
 * sites that have not yet migrated: because the old `tagged`-based `case`
 * returned `any`, they relied on that looseness and would break under `match`'s
 * precise union return type (which would poison downstream JSX / assignments).
 *
 * NEW CODE SHOULD USE {@link match} (or {@link fold}) — they are fully typed and
 * exhaustiveness-aware. `case` exists only to keep un-migrated consumers
 * compiling and should be removed once migration completes.
 *
 * @deprecated Use `AsyncResult.match` / `AsyncResult.fold`.
 */
export function caseCompat(cases: Cases): (inst: any, ...extra: any[]) => any
export function caseCompat(cases: Cases, inst: any, ...extra: any[]): any
export function caseCompat(cases: Cases, ...applied: any[]): any {
  return (match as any)(cases, ...applied)
}

// ---------------------------------------------------------------------------
// mapCase / prop / props — variant-scoped map that stays an AsyncResult
// ---------------------------------------------------------------------------

/**
 * Map over one-or-more variants and RE-BOX into the same variant. Unlisted
 * variants pass through untouched. This is a functor-map, not a general match:
 * the output is still an `AsyncResult`.
 *
 *   mapCase({ Ok: v => v.body })(result)     // Ok is transformed, rest passthrough
 *   mapCase({ Ok, Err }, result)             // eager
 */
export interface MapCases<A, E, A2 = A, E2 = E> {
  Init?: () => undefined
  Pending?: (prev: PendingPrev<A, E> | undefined) => PendingPrev<A2, E2> | undefined
  Ok?: (value: A) => A2
  Err?: (error: E) => E2
}

const runMapCase = <A, E, A2, E2>(
  cases: MapCases<A, E, A2, E2>,
  inst: AsyncResult<A, E>,
): AsyncResult<A2, E2> => {
  if (isOk(inst)) return cases.Ok ? ok(cases.Ok(inst.value as A)) : (inst as any)
  if (isErr(inst)) return cases.Err ? err(cases.Err(inst.value as E)) : (inst as any)
  if (isPending(inst))
    return cases.Pending ? pending(cases.Pending(inst.value)) : (inst as any)
  if (isInit(inst)) return inst
  return inst as any
}

export function mapCase<A, E, A2 = A, E2 = E>(
  cases: MapCases<A, E, A2, E2>,
): (inst: AsyncResult<A, E>) => AsyncResult<A2, E2>
export function mapCase<A, E, A2 = A, E2 = E>(
  cases: MapCases<A, E, A2, E2>,
  inst: AsyncResult<A, E>,
): AsyncResult<A2, E2>
export function mapCase<A, E, A2, E2>(
  cases: MapCases<A, E, A2, E2>,
  inst?: AsyncResult<A, E>,
): AsyncResult<A2, E2> | ((inst: AsyncResult<A, E>) => AsyncResult<A2, E2>) {
  const run = (i: AsyncResult<A, E>) => runMapCase(cases, i)
  return arguments.length >= 2 ? run(inst as AsyncResult<A, E>) : run
}

/**
 * `mapCaseCompat` — LEGACY-COMPAT variant-map, exposed as `AsyncResult.mapCase`.
 *
 * Same runtime as {@link mapCase} but the source instance's payload type is not
 * required to match the handler's declared input (the old `tagged.mapCase`
 * accepted `any`). Kept loose so un-migrated `.mapCase` sites — several of which
 * map a handler expecting a narrow type over an `AsyncResult<unknown>` source —
 * keep compiling. New code should use the strict named {@link mapCase}.
 *
 * @deprecated Use the strict `mapCase` named export.
 */
export function mapCaseCompat(cases: MapCases<any, any, any, any>): (inst: any) => any
export function mapCaseCompat(cases: MapCases<any, any, any, any>, inst: any): any
export function mapCaseCompat(cases: MapCases<any, any, any, any>, inst?: any): any {
  const run = (i: any) => runMapCase(cases, i)
  return arguments.length >= 2 ? run(inst) : run
}

/**
 * `prop(name, inst?)` — sugar for `mapCase({ Ok: R.prop(name) })`. Replaces the
 * `Ok` payload with `value[name]`; other variants pass through. Curried + eager.
 *
 * When the source's `Ok` type is known, the picked field is inferred precisely.
 * A trailing loose overload keeps un-migrated call sites that map over an
 * `AsyncResult<unknown>` (where `keyof A` is `never`) compiling.
 */
export function prop<A, K extends keyof A>(
  name: K,
): <E>(inst: AsyncResult<A, E>) => AsyncResult<A[K], E>
export function prop<A, K extends keyof A, E>(
  name: K,
  inst: AsyncResult<A, E>,
): AsyncResult<A[K], E>
// Loose compat overload (source Ok type unknown / `$TSFixMe`):
export function prop(name: string): (inst: any) => AsyncResult<any, any>
export function prop(name: string, inst: any): AsyncResult<any, any>
export function prop(name: any, inst?: any): any {
  const run = (i: any): any => runMapCase({ Ok: (v: any) => v[name] }, i)
  return arguments.length >= 2 ? run(inst) : run
}

/**
 * `props(names, inst)` — build a record mapping each name to `prop(name, inst)`
 * (a per-field AsyncResult). Eager (has zero external call sites today, but is
 * part of the published surface).
 */
export function props<A, K extends keyof A, E>(
  names: readonly K[],
  inst: AsyncResult<A, E>,
): { [P in K]: AsyncResult<A[P], E> } {
  return names.reduce(
    (acc, name) => ({ ...acc, [name]: prop(name as any, inst) }),
    {} as { [P in K]: AsyncResult<A[P], E> },
  )
}

// ---------------------------------------------------------------------------
// prevResult — walk `Pending` boxes down to the last `Ok`
// ---------------------------------------------------------------------------

/**
 * Recurse through `Pending` payloads (both the nested-`AsyncResult` form and the
 * `{ prev }` record form used by `utils/Data`) to the most recent `Ok` value,
 * returning `null` if there is none. Preserves the legacy `getPrevResult`
 * semantics: it returns the *unboxed Ok value*, not the Ok wrapper.
 */
export function prevResult<A>(inst: AsyncResult<A, unknown>): A | null {
  if (isOk(inst)) return inst.value as A
  if (isPending(inst)) {
    const p = inst.value
    if (p == null) return null
    if (is(p)) return prevResult(p as AsyncResult<A, unknown>)
    if (typeof p === 'object' && 'prev' in p && p.prev != null) {
      return prevResult(p.prev as AsyncResult<A, unknown>)
    }
    return null
  }
  return null
}

// ---------------------------------------------------------------------------
// Combinators — the rich, ergonomic surface for new consumers
// ---------------------------------------------------------------------------

/** Map the `Ok` payload; every other variant passes through unchanged. */
export const map =
  <A, B>(f: (a: A) => B) =>
  <E>(r: AsyncResult<A, E>): AsyncResult<B, E> =>
    isOk(r) ? ok(f(r.value as A)) : (r as any)

/** Map the `Err` payload; every other variant passes through unchanged. */
export const mapErr =
  <E, E2>(f: (e: E) => E2) =>
  <A>(r: AsyncResult<A, E>): AsyncResult<A, E2> =>
    isErr(r) ? err(f(r.value as E)) : (r as any)

/**
 * Monadic bind on `Ok`. `andThen` is an alias. The continuation returns a new
 * `AsyncResult`; non-`Ok` variants pass through.
 */
export const flatMap =
  <A, B, E2>(f: (a: A) => AsyncResult<B, E2>) =>
  <E>(r: AsyncResult<A, E>): AsyncResult<B, E | E2> =>
    isOk(r) ? f(r.value as A) : (r as any)

export { flatMap as andThen }

/** The `Ok` value, or `onElse` for any non-`Ok` variant. */
export const getOrElse =
  <A, B>(onElse: (r: AsyncResult<A, unknown>) => B) =>
  <E>(r: AsyncResult<A, E>): A | B =>
    isOk(r) ? (r.value as A) : onElse(r)

/** The `Ok` value, or `null`. */
export const getOrNull = <A>(r: AsyncResult<A, unknown>): A | null =>
  isOk(r) ? (r.value as A) : null

/**
 * Total fold — like {@link match} but every branch is required (fully
 * exhaustive, no fallback). Named handlers get the unboxed payload.
 */
export const fold =
  <A, E, R>(cases: {
    Init: () => R
    Pending: (prev: PendingPrev<A, E> | undefined) => R
    Ok: (value: A) => R
    Err: (error: E) => R
  }) =>
  (r: AsyncResult<A, E>): R =>
    runCase(cases, r, []) as R

// ---------------------------------------------------------------------------
// Default export — namespaced, PascalCase constructors (drop-in for call sites)
// ---------------------------------------------------------------------------

// Attach `.is` (and legacy `.unbox`) to the PascalCase constructor references so
// that `AsyncResult.Ok.is(x)` / `AsyncResult.Err.is(x)` keep working. `.is`
// optionally takes a predicate on the unboxed value (legacy `tagged` behaviour).

// A constructor is its plain callable `Fn` plus a `.is` refinement (narrowing to
// the concrete variant class `Inst`) and a legacy `.unbox`. The callable and the
// refinement have *independent* types: `Ok(v)` returns the wide union, but
// `Ok.is(x)` narrows to `Ok`.
type Ctor<Fn extends (...args: any[]) => AsyncResult<any, any>, Inst> = Fn & {
  is: (r: unknown, pred?: (value: any) => boolean) => r is Inst
  // `unbox` accepts any AsyncResult (it is a legacy escape hatch, typically
  // guarded by a prior `.is` check) and returns the variant's payload type.
  unbox: (r: AsyncResult<any, any>) => Inst extends { value: infer V } ? V : never
}

const withStatics = <Fn extends (...args: any[]) => AsyncResult<any, any>, Inst>(
  ctor: Fn,
  guard: (r: unknown) => r is Inst,
): Ctor<Fn, Inst> =>
  Object.assign(ctor, {
    is: (r: unknown, pred?: (value: any) => boolean): r is Inst =>
      guard(r) && (pred ? pred((r as any).value) : true),
    unbox: (r: AsyncResult<any, any>) => (r as any).value as any,
  }) as Ctor<Fn, Inst>

const OkCtor = withStatics(ok, isOk)
const ErrCtor = withStatics(err, isErr)
const InitCtor = withStatics(init, isInit)
const PendingCtor = withStatics(pending, isPending)

// Legacy-compat call signature for the default-export constructors: the old
// `tagged` factory allowed a zero-arg call (`AsyncResult.Err()` → value
// `undefined`) and was used point-free in positions (`GQL.fold` cases, `.then`)
// that infer a wide `AsyncResult` result. The default-export `Ok`/`Err`/`Init`/
// `Pending` are typed loosely to keep those un-migrated sites compiling; the
// *named* exports (`ok`/`err`/`init`/`pending`) stay strict for new code.
type CompatCtor<Inst> = {
  <A>(value?: A): AsyncResult<A, unknown>
  is: (r: unknown, pred?: (value: any) => boolean) => r is Inst
  unbox: (r: AsyncResult<any, any>) => any
}

const AsyncResult = {
  // Constructors (bare callable references)
  Ok: OkCtor as unknown as CompatCtor<Ok>,
  Err: ErrCtor as unknown as CompatCtor<Err>,
  Init: InitCtor as unknown as CompatCtor<Init>,
  Pending: PendingCtor as unknown as CompatCtor<Pending>,

  // Matching. `case` is the deprecated loose-typed compat matcher; `match`
  // (and `fold`) are the strict, fully-typed replacements for new code.
  case: caseCompat,
  match,
  fold,

  // Variant-scoped map (stays an AsyncResult). `.mapCase` is the loose compat
  // form; the strict `mapCase` named export is preferred for new code.
  mapCase: mapCaseCompat,
  prop,
  props,

  // Refinements
  is,
  isInit,
  isPending,
  isOk,
  isErr,

  // Combinators
  map,
  mapErr,
  flatMap,
  andThen: flatMap,
  getOrElse,
  getOrNull,

  // prev-result recursion
  prevResult,
  /** @deprecated legacy spelling — use `prevResult` */
  getPrevResult: prevResult,
}

export default AsyncResult
