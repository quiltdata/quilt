// markdown-it 14 ships no types of its own; they come from @types/markdown-it,
// whose ESM entry (index.d.mts) re-exports only `default` + option types — not
// StateInline/Token. Under exports-aware resolution (moduleResolution: bundler)
// the named root import `{ StateInline, Token } from 'markdown-it'` therefore
// fails, so we reach them at their subpath modules, where each is the default
// export. The `.mjs` extension is required for TS to locate the `.d.mts`.
//
// Centralized here so use-sites keep clean named imports and this brittleness
// (subpath layout + extension) lives in exactly one place.
export type { default as StateInline } from 'markdown-it/lib/rules_inline/state_inline.mjs'
export type { default as Token } from 'markdown-it/lib/token.mjs'
