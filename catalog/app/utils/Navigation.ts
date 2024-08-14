import * as Eff from 'effect'
import * as RR from 'react-router-dom'
import { UrlParams } from '@effect/platform'
import { Schema as S, ParseResult } from '@effect/schema'

import { JsonRecord } from 'utils/types'

// XXX: make into a class?
export const Location = S.Struct({
  pathname: S.String,
  search: S.String,
  hash: S.String,
})

const SearchParamAll = S.Array(S.String)

export const SearchParams = S.Record({ key: S.String, value: SearchParamAll })

export const SearchParamLastOpt = S.optionalToOptional(SearchParamAll, S.String, {
  decode: Eff.Option.flatMap(Eff.Array.last),
  encode: Eff.Option.map(Eff.Array.of),
})

const SearchParamsFromUrlParams = S.transform(UrlParams.schema, SearchParams, {
  encode: UrlParams.fromInput,
  decode: (input) =>
    input.reduce(
      (acc, [k, v]) => ({ ...acc, [k]: [...(k in acc ? acc[k] : []), v] }),
      {} as Record<string, string[]>,
    ),
})

const UrlParamsFromString = S.transform(S.String, UrlParams.schema, {
  encode: UrlParams.toString,
  decode: (input) => UrlParams.fromInput(new URLSearchParams(input)),
})

const SearchParamsFromString = S.compose(UrlParamsFromString, SearchParamsFromUrlParams)

export const PathParams = S.Record({
  key: S.String,
  value: S.Union(S.String, S.Number, S.Boolean),
})

export const fromPathParams = <T extends typeof PathParams.Type>(schema: S.Schema<T>) =>
  S.transformOrFail(PathParams, schema, {
    encode: (toI) => Eff.Effect.succeed(toI),
    decode: (fromA, _parseOptions, ast) =>
      Eff.pipe(
        fromA,
        S.decodeUnknown(schema),
        Eff.Effect.mapError((e) => new ParseResult.Type(ast, fromA, e.message)),
      ),
  })

const matchPath = (path: string, exact: boolean, strict: boolean) =>
  S.transformOrFail(S.String, PathParams, {
    decode: (input, options, ast) => {
      const match = RR.matchPath(input, { path, exact, strict })
      if (!match)
        return ParseResult.fail(
          new ParseResult.Type(ast, input, `Path does not match path pattern '${path}'`),
        )
      return ParseResult.succeed(match.params)
    },
    encode: (input, options, ast) =>
      Eff.pipe(
        Eff.Effect.try(() => RR.generatePath(path, input)),
        Eff.Effect.mapError(
          (e) =>
            new ParseResult.Type(
              ast,
              input,
              `Params does not match path pattern '${path}': ${e}`,
            ),
        ),
      ),
  })

const emptySearchParams = S.transform(SearchParams, S.Struct({}), {
  encode: () => ({}),
  decode: () => ({}),
})

const emptyPathParams = S.transform(PathParams, S.Struct({}), {
  encode: () => ({}),
  decode: () => ({}),
})

const ParsedLocation = S.Struct({
  pathParams: PathParams,
  searchParams: SearchParams,
})

// XXX: accept route matching params? e.g. strict etc*/
function makeParsedLocation(path: string, exact: boolean, strict: boolean) {
  const pathParamsSchema = matchPath(path, exact, strict)
  return S.transformOrFail(Location, ParsedLocation, {
    decode: (input, options, ast) =>
      Eff.Effect.gen(function* () {
        const pathParams = yield* Eff.pipe(
          input.pathname,
          S.decode(pathParamsSchema, options),
          Eff.Effect.mapError((e) => new ParseResult.Type(ast, input, e.toString())),
        )
        const searchParams = S.decodeSync(SearchParamsFromString, options)(input.search)
        return { pathParams, searchParams }
      }),
    encode: (input, options, ast) =>
      Eff.Effect.gen(function* () {
        const pathname = yield* Eff.pipe(
          input.pathParams,
          S.encode(pathParamsSchema, options),
          Eff.Effect.mapError((e) => new ParseResult.Type(ast, input, e.toString())),
        )
        const search = S.encodeSync(SearchParamsFromString, options)(input.searchParams)
        return { pathname, search, hash: '' }
      }),
  })
}

function makeParsedParams<
  RouteSearchParams extends JsonRecord,
  RoutePathParams extends JsonRecord,
>(
  SPS: S.Schema<RouteSearchParams, typeof SearchParams.Type>,
  PPS: S.Schema<RoutePathParams, typeof PathParams.Type>,
) {
  const RouteParamsSchema = S.extend(S.typeSchema(SPS), S.typeSchema(PPS))
  return S.transformOrFail(ParsedLocation, RouteParamsSchema, {
    decode: (input, options, ast) =>
      Eff.Effect.gen(function* () {
        // XXX: accumulate both errors
        const pathParams = yield* Eff.pipe(
          input.pathParams,
          S.decode(PPS, options),
          Eff.Effect.mapError((e) => new ParseResult.Type(ast, input, `${e}`)),
        )
        const searchParams = yield* Eff.pipe(
          input.searchParams,
          S.decode(SPS, options),
          Eff.Effect.mapError((e) => new ParseResult.Type(ast, input, `${e}`)),
        )
        return { ...searchParams, ...pathParams }
      }),
    encode: (input, options, ast) =>
      Eff.Effect.gen(function* () {
        // XXX: accumulate both errors
        const pathParams = yield* Eff.pipe(
          input,
          S.encode(PPS, options),
          Eff.Effect.mapError((e) => new ParseResult.Type(ast, input, e.toString())),
        )
        const searchParams = yield* Eff.pipe(
          input,
          S.encode(SPS, options),
          Eff.Effect.mapError((e) => new ParseResult.Type(ast, input, e.toString())),
        )
        return { searchParams, pathParams }
      }),
  })
}

interface RouteDescriptor<
  Name extends string,
  Path extends string,
  RouteSearchParams extends JsonRecord = {},
  RoutePathParams extends JsonRecord = {},
> {
  name: Name
  path: Path
  exact: boolean
  strict: boolean
  description: string
  paramsSchema: S.Schema<RouteSearchParams & RoutePathParams, typeof Location.Type>
  navigableRouteSchema: S.Schema<{
    name: Name
    params: RouteSearchParams & RoutePathParams
  }>
  waitForMarkers: string[]
}

export function makeRoute<
  const Name extends string,
  const Path extends string,
  RouteSearchParams extends JsonRecord = {},
  RoutePathParams extends JsonRecord = {},
>(input: {
  name: Name
  path: Path
  exact?: boolean
  strict?: boolean
  description: string
  searchParams?: S.Schema<RouteSearchParams, typeof SearchParams.Type>
  pathParams?: S.Schema<RoutePathParams, typeof PathParams.Type>
  waitForMarkers?: string[]
}): RouteDescriptor<Name, Path, RouteSearchParams, RoutePathParams> {
  const exact = input.exact ?? false
  const strict = input.strict ?? false

  // Location <-> ParsedLocation
  const locationSchema = makeParsedLocation(input.path, exact, strict)

  const searchParams =
    input.searchParams ??
    (emptySearchParams as unknown as S.Schema<
      RouteSearchParams,
      typeof SearchParams.Type
    >)
  const pathParams =
    input.pathParams ??
    (emptyPathParams as unknown as S.Schema<RoutePathParams, typeof PathParams.Type>)

  // ParsedLocation <-> RouteParams
  const parseParams = makeParsedParams(searchParams, pathParams)

  // Location <-> RouteParams
  const paramsSchema = S.compose(locationSchema, parseParams)

  const navigableRouteSchema = S.typeSchema(
    S.Struct({
      name: S.Literal(input.name),
      params: paramsSchema,
    }),
  ).annotations({
    description: input.description,
  })

  return {
    name: input.name,
    path: input.path,
    exact,
    strict,
    paramsSchema,
    navigableRouteSchema,
    description: input.description,
    waitForMarkers: input.waitForMarkers ?? [],
  }
}
