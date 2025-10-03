export interface MCPServerTemplate {
  id: string
  name: string
  description: string
  category:
    | 'literature'
    | 'clinical'
    | 'genomics'
    | 'proteins'
    | 'cheminformatics'
    | 'ontologies'
    | 'omics'
    | 'lab'
  requiresAuth: boolean
  authType?: 'api-key' | 'oauth' | 'none'
  documentationUrl?: string
  defaultEndpoint?: string
}

export const MCP_SERVER_CATEGORIES = {
  literature: {
    label: 'Literature & Knowledge',
    icon: '📚',
    color: '#5E35B1',
  },
  clinical: {
    label: 'Clinical Data',
    icon: '🏥',
    color: '#1976D2',
  },
  genomics: {
    label: 'Genomics',
    icon: '🧬',
    color: '#388E3C',
  },
  proteins: {
    label: 'Proteins & Structures',
    icon: '🧪',
    color: '#D32F2F',
  },
  cheminformatics: {
    label: 'Cheminformatics & Drugs',
    icon: '💊',
    color: '#F57C00',
  },
  ontologies: {
    label: 'Ontologies & Enrichment',
    icon: '🔬',
    color: '#0097A7',
  },
  omics: {
    label: '"Omics" & Research',
    icon: '📊',
    color: '#7B1FA2',
  },
  lab: {
    label: 'Laboratory Data',
    icon: '⚗️',
    color: '#00796B',
  },
} as const

export const MCP_SERVER_TEMPLATES: MCPServerTemplate[] = [
  // Literature & Knowledge Retrieval
  {
    id: 'pubmed',
    name: 'PubMed',
    description: 'Search and retrieve biomedical papers via NCBI E-utilities',
    category: 'literature',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK25501/',
  },
  {
    id: 'ncbi-literature',
    name: 'NCBI Literature',
    description: 'Broader NCBI search across PubMed and multiple databases',
    category: 'literature',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://www.ncbi.nlm.nih.gov/',
  },
  {
    id: 'open-targets',
    name: 'Open Targets',
    description: 'Gene-disease associations via Open Targets GraphQL API',
    category: 'literature',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://platform.opentargets.org/',
  },

  // Clinical Data
  {
    id: 'clinicaltrials',
    name: 'ClinicalTrials.gov',
    description: 'List and fetch clinical trials by NCT, phase, status, etc.',
    category: 'clinical',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://clinicaltrials.gov/',
  },
  {
    id: 'healthcare-data-hub',
    name: 'Healthcare Data Hub',
    description: 'Composite server: FDA labels, PubMed, clinical trials, ICD-10',
    category: 'clinical',
    requiresAuth: false,
    authType: 'none',
  },

  // Genomics
  {
    id: 'ensembl',
    name: 'Ensembl',
    description: 'Genes, transcripts, variants, and comparative genomics data',
    category: 'genomics',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://www.ensembl.org/',
  },
  {
    id: 'cellxgene',
    name: 'CellxGene',
    description: 'Access single-cell genomics data from CellxGene',
    category: 'genomics',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://cellxgene.cziscience.com/',
  },

  // Proteins & Structures
  {
    id: 'uniprot',
    name: 'UniProt',
    description: 'Protein function and sequence lookups with caching & batch tools',
    category: 'proteins',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://www.uniprot.org/',
  },
  {
    id: 'pdb',
    name: 'Protein Data Bank (PDB)',
    description: 'Query protein structures, assemblies, and components',
    category: 'proteins',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://www.rcsb.org/',
  },
  {
    id: 'pymol',
    name: 'PyMOL',
    description: 'Drive molecular visualization and figure rendering via MCP',
    category: 'proteins',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://pymol.org/',
  },

  // Cheminformatics & Drugs
  {
    id: 'chembl',
    name: 'ChEMBL',
    description: 'Bioactivity queries, target/compound lookups, assay enrichment',
    category: 'cheminformatics',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://www.ebi.ac.uk/chembl/',
  },
  {
    id: 'pubchem',
    name: 'PubChem',
    description: 'Compound properties, bioassays, and safety information',
    category: 'cheminformatics',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://pubchem.ncbi.nlm.nih.gov/',
  },
  {
    id: 'drugbank',
    name: 'DrugBank',
    description: 'Drug indications, interactions, and categories',
    category: 'cheminformatics',
    requiresAuth: true,
    authType: 'api-key',
    documentationUrl: 'https://www.drugbank.com/',
  },
  {
    id: 'openfda',
    name: 'openFDA',
    description: 'FDA adverse events, labeling, and recalls',
    category: 'cheminformatics',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://open.fda.gov/',
  },
  {
    id: 'dailymed',
    name: 'DailyMed',
    description: 'FDA SPL labels and drug information',
    category: 'cheminformatics',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://dailymed.nlm.nih.gov/',
  },

  // Ontologies & Enrichment
  {
    id: 'hpo',
    name: 'Human Phenotype Ontology (HPO)',
    description: 'Phenotype term lookup and relationships',
    category: 'ontologies',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://hpo.jax.org/',
  },
  {
    id: 'gene-ontology',
    name: 'Gene Ontology (GO)',
    description: 'Ontology access and functional enrichment helpers',
    category: 'ontologies',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'http://geneontology.org/',
  },
  {
    id: 'bioportal',
    name: 'BioPortal',
    description: '1,200+ biomedical ontologies (NCIt, DOID, MeSH, CHEBI, UBERON)',
    category: 'ontologies',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://bioportal.bioontology.org/',
  },
  {
    id: 'ols',
    name: 'Ontology Lookup Service (OLS)',
    description: 'Unified biomedical and medical ontology search',
    category: 'ontologies',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://www.ebi.ac.uk/ols/',
  },
  {
    id: 'enrichr',
    name: 'Enrichr',
    description: 'GO BP enrichment and over-representation analysis from gene lists',
    category: 'ontologies',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://maayanlab.cloud/Enrichr/',
  },

  // "Omics" & Research Toolboxes
  {
    id: 'depmap',
    name: 'DepMap',
    description: 'Gene-gene correlation analysis from CRISPR screens and co-essentiality',
    category: 'omics',
    requiresAuth: false,
    authType: 'none',
    documentationUrl: 'https://depmap.org/',
  },
  {
    id: 'nextflow',
    name: 'Nextflow',
    description: 'Manage and execute Nextflow bioinformatics workflows',
    category: 'omics',
    requiresAuth: true,
    authType: 'api-key',
    documentationUrl: 'https://www.nextflow.io/',
  },

  // Laboratory Data
  {
    id: 'benchling',
    name: 'Benchling',
    description: 'Access notebook entries, DNA sequences, and lab data',
    category: 'lab',
    requiresAuth: true,
    authType: 'api-key',
    documentationUrl: 'https://docs.benchling.com/api',
  },
]

export function getServersByCategory(category: string): MCPServerTemplate[] {
  return MCP_SERVER_TEMPLATES.filter((server) => server.category === category)
}

export function getAllCategories() {
  return Object.keys(MCP_SERVER_CATEGORIES)
}
