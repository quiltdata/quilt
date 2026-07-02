// FrontDoor v3-eval: lightweight, heuristic criteria extraction for the Qurator
// interpreted-plan panel. This mirrors the prototype's "Interpreted as…" preview;
// it is a client-side hint only and does not call any backend.

export interface Criterion {
  key: string
  value: string
  fixed?: boolean
}

const KNOWN: Record<string, { key: string; value: string }> = {
  ccle: { key: 'dataset', value: 'CCLE' },
  tcga: { key: 'dataset', value: 'TCGA' },
  allen: { key: 'dataset', value: 'Allen Cell' },
  ovarian: { key: 'topic', value: 'ovarian cancer' },
  brca1: { key: 'gene', value: 'BRCA1' },
  melanoma: { key: 'topic', value: 'melanoma' },
  pbmc: { key: 'topic', value: 'PBMC' },
  cardiomyocyte: { key: 'topic', value: 'cardiomyocyte' },
  pathology: { key: 'topic', value: 'pathology' },
  starsolo: { key: 'source', value: 'STARsolo outputs' },
  scrna: { key: 'assay', value: 'scRNA-seq' },
}

const ACTIONS: Record<string, string> = {
  compare: 'compare',
  summar: 'summarize',
  create: 'create package',
  run: 'run query',
  list: 'list',
  count: 'count',
}

const TABULAR =
  /\b(athena|sql|tabulator|tables?|query|join|aggregate|column|rows?|select |group by|count of|how many)\b/i

export function isTabular(query: string): boolean {
  return TABULAR.test(query)
}

export function extractCriteria(query: string): Criterion[] {
  const low = ` ${query.toLowerCase()} `
  const tab = isTabular(query)
  const out: Criterion[] = [
    { key: 'scope', value: tab ? 'tables' : 'packages', fixed: true },
  ]
  if (tab) out.push({ key: 'engine', value: 'Tabulator → Athena' })
  for (const key of Object.keys(KNOWN)) {
    if (low.includes(key)) out.push({ key: KNOWN[key].key, value: KNOWN[key].value })
  }
  for (const a of Object.keys(ACTIONS)) {
    if (low.includes(a)) {
      out.push({ key: 'action', value: ACTIONS[a] })
      break
    }
  }
  return out
}
