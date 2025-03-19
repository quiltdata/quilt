export interface WorkflowsConfig {
  isWorkflowRequired: boolean // default: true
  // defaultWorkflowId?: string

  defaultWorkflow?: Workflow

  workflows: Workflow[]
  schemas: Schema[]
  successors: Successor[]

  catalog?: {
    package_handle?: {
      files?: string
      packages?: string
    }
  }
}

export interface Workflow {
  id: string
  name: string
  isMessageRequired: boolean // default: false
  handlePattern?: string // regex
  metadataSchema?: Schema
  entriesSchema?: Schema
}

// XXX: support nesting
export interface SchemaField {
  label: string
  type: string // TODO: support facet types from faceted search
}

export interface Schema {
  id: string
  url: string
  // TODO: add inferred schema properties (fields/facets)
  fields: SchemaField[]
}

export interface Successor {
  url: string // s3://quilt-workflow
  // bucketName: string ??
  title: string
  copyData: boolean // default: true
}

const field = (label: string, type: string, props: Record<string, any>): SchemaField => ({
  label,
  type,
  ...props,
})

const schemas: Schema[] = [
  {
    id: 'enum-min-max',
    url: 's3://quilt-workflow/.quilt/workflows/enum-min-max.schema.json',
    fields: [],
  },
  {
    id: 'enum-extra',
    url: 's3://quilt-workflow/.quilt/workflows/enum-extra-items.schema.json',
    fields: [],
  },
  {
    id: 'experiment-universal',
    url: 's3://quilt-workflow/.quilt/workflows/experiment-universal.json',
    fields: [],
  },
  {
    id: 'sra-raw-data',
    url: 's3://quilt-example-bucket/.quilt/workflows/sra-raw-data.schema.json',
    fields: [
      field('Run', 'string', {
        description: 'SRA run ID for sample',
        required: true,
      }),
      field('Age', 'number', {
        description: 'Age of patient sample was collected from in years',
        required: false,
      }),
      field('AssayType', 'stringEnum', {
        description: 'NGS assay performed to generate data',
        required: true,
        enum: ['RNA-Seq', 'WES', 'WGS', 'CRISPR'],
      }),
      field('AssemblyName', 'string', {
        description: 'GenBank assembly accession for reference genome',
        required: false,
      }),
      field('AvgSpotLen', 'integer', {
        description: 'Average number of base pairs in a single spot (aka read length)',
        required: true,
        enum: [198, 202],
      }),
      field('Bases', 'integer', {
        description:
          'Total number of nucleotide bases in a sequencing dataset for a given sample',
        required: false,
      }),
      field('DiseaseStage', 'stringEnum', {
        description: 'Stage of tumor development',
        required: true,
        enum: ['primary', 'metastasis', 'benign_neoplasia'],
        nullable: true,
      }),
      field('ReleaseDate', 'dateTime', {
        description: 'Date data was released on SRA database',
        required: true,
      }),
    ],
  },
  {
    id: 'ngs-rnaseq',
    url: 's3://quilt-example-bucket/.quilt/workflows/ngs_rnaseq.schema.json',
    fields: [],
  },
  {
    id: 'ngs-wes',
    url: 's3://quilt-example-bucket/.quilt/workflows/ngs_wes.schema.json',
    fields: [],
  },
]

const schemasById: Record<string, Schema> = schemas.reduce(
  (acc, schema) => ({ ...acc, [schema.id]: schema }),
  {},
)

const workflows: Workflow[] = [
  {
    id: 'alpha',
    name: 'Default',
    isMessageRequired: true,
  },
  {
    id: 'beta',
    name: 'MassSpec Workflow',
    isMessageRequired: true,
    metadataSchema: schemasById['enum-min-max'],
  },
  {
    id: 'gamma',
    name: 'QPCR Workflow',
    isMessageRequired: true,
    metadataSchema: schemasById['enum-extra-items'],
  },
  {
    id: 'delta',
    name: 'Sandbox Workflow',
    isMessageRequired: false,
    metadataSchema: schemasById['experiment-universal'],
  },
  {
    id: 'sra-raw-data',
    name: 'Raw data obtained from the Sequence Read Archive (SRA)',
    isMessageRequired: true,
    metadataSchema: schemasById['sra-raw-data'],
  },
  {
    id: 'ngs-rnaseq',
    name: 'Template metadata for packages containing RNA-seq data',
    isMessageRequired: false,
    metadataSchema: schemasById['ngs-rnaseq'],
  },
  {
    id: 'ngs-wes',
    name: 'Template metadata for packages containing WES data',
    isMessageRequired: false,
    metadataSchema: schemasById['ngs-wes'],
  },
]

const successors: Successor[] = [
  {
    url: 's3://quilt-workflow',
    title: 'Workflow Examples',
    copyData: true,
  },
]

export const stub: WorkflowsConfig = {
  isWorkflowRequired: false,
  defaultWorkflow: workflows[0],
  workflows,
  schemas,
  successors,
}
