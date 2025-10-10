import * as Eff from 'effect'

export type AttrValue = string | number | boolean | null | undefined

export type Attrs = Record<string, AttrValue>

export type Child = Tag | string | null

export type Children = Child[]

export class Tag {
  readonly name: string

  readonly attrsProp: Attrs

  readonly childrenProp: Children

  constructor(name: string, attrs: Attrs, children: Children) {
    this.name = name
    this.attrsProp = attrs
    this.childrenProp = children
  }

  static make(name: string, attrs: Attrs = {}, ...children: Children) {
    return new Tag(name, attrs, children)
  }

  attr(name: string, value: AttrValue) {
    return new Tag(this.name, { ...this.attrsProp, [name]: value }, this.childrenProp)
  }

  attrs(attrs: Attrs) {
    return new Tag(this.name, { ...this.attrsProp, ...attrs }, this.childrenProp)
  }

  children(...children: Children) {
    return new Tag(this.name, this.attrsProp, [...this.childrenProp, ...children])
  }

  toString(): string {
    const attrs = Object.entries(this.attrsProp)
      .map(([k, v]) => {
        if (v === null || v === undefined || v === false) return ''
        if (v === true) return ` ${k}`
        return ` ${k}=${JSON.stringify(v)}`
      })
      .join('')

    const children = Eff.pipe(
      this.childrenProp,
      Eff.Array.filterMap(
        Eff.flow(
          Eff.Option.fromNullable,
          Eff.Option.map((c) => (typeof c === 'string' ? c : c.toString())),
        ),
      ),
    )

    const parts = [`<${this.name}${attrs}>`, ...children, `</${this.name}>`]

    return parts.join('\n')
  }
}

export const tag = Tag.make
