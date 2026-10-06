import * as Model from 'model'

// Shared by Admin › Status and Admin › GxP so both read one cached status query.
export const STATS_WINDOW = 30
export const DEFAULT_REPORTS_PER_PAGE = 25
export const DEFAULT_REPORTS_ORDER = Model.GQLTypes.StatusReportListOrder.NEW_FIRST
