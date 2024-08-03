import * as Eff from 'effect'

type AttrValue = string | number

type Attrs = Record<string, AttrValue>

type Child = Tag | string | null

type Children = Child[]

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

  attrs(attrs: Attrs) {
    return new Tag(this.name, { ...this.attrsProp, ...attrs }, this.childrenProp)
  }

  children(...children: Children) {
    return new Tag(this.name, this.attrsProp, [...this.childrenProp, ...children])
  }

  toString(): string {
    const attrs = Object.entries(this.attrsProp)
      .map(([k, v]) => ` ${k}=${JSON.stringify(v)}`)
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
