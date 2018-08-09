// flow-typed signature: 104549010077e5ab3f721b14eec18869
// flow-typed version: d566ab41b9/query-string_v5.1.x/flow_>=v0.32.x

declare module 'query-string' {
  declare type ArrayFormat = 'none' | 'bracket' | 'index'
  declare type ParserOptions = {|
    arrayFormat?: ArrayFormat,
  |}

  declare type StringifyOptions = {|
    arrayFormat?: ArrayFormat,
    encode?: boolean,
    strict?: boolean,
    sort?: false | <A, B>(A, B) => number,
  |}

  declare module.exports: {
    extract(input: string): string,
    parse(input: string, options?: ParserOptions): { [name: string]: string | Array<string> },
    parseUrl(input: string, options?: ParserOptions): {
      url: string,
      query: { [name: string]: string | Array<string> }
    },
    stringify(obj: { [name: string]: mixed }, options?: StringifyOptions): string,
  }
}
