from metadata_service import athena




class Query:
    """
    User-facing class
    """
    def __init__(self, package=None, tophash=None):
        self.package = package
        self.tophash = tophash
        self.tophash_prefix = None
        if tophash is not None:
            self.tophash_prefix = tophash[:2]
        self.select_params = []
        self.where_clauses = []

    def select(self, params, *args):
        if isinstance(params, (str, dict, PrestoJsonSugarInstance)):
            params = [params]

        assert isinstance(params, list)
        for p in params:
            assert isinstance(p, (str, dict, PrestoJsonSugarInstance))

        params.extend(args)

        # Build where clauses that use PrestoJsonSugarInstance
        for i in range(len(params)):
            clause = params[i]
            if isinstance(clause, PrestoJsonSugarInstance):
                clause = clause.build()
            if isinstance(clause, dict):
                for k in clause.keys():
                    if isinstance(clause[k], PrestoJsonSugarInstance):
                        clause[k] = clause[k].build()
            params[i] = clause

        self.select_params = params
        return self

    def where(self, where_clauses, *args):
        if isinstance(where_clauses, (str, PrestoJsonSugarInstance)):
            where_clauses = [where_clauses]

        assert isinstance(where_clauses, list)
        for p in where_clauses:
            assert isinstance(p, (str, PrestoJsonSugarInstance)), type(p)

        where_clauses.extend(args) # Accept positional arguments instead of a single list argument

        # Build where clauses that use PrestoJsonSugarInstance
        for i in range(len(where_clauses)):
            clause = where_clauses[i]
            if isinstance(clause, PrestoJsonSugarInstance):
                clause = clause.build()
            where_clauses[i] = clause
        self.where_clauses = where_clauses
        return self


    def _gen_select_sql(self):
        select_sql = "SELECT"
        for i, select_param in enumerate(self.select_params):
            select_clause = "\n, " if i>0 else " "
            if isinstance(select_param, str):
                select_clause += select_param
            if isinstance(select_param, dict):
                assert len(select_param.keys()) == 1
                k, v = list(select_param.items())[0]
                # v = select_param[k]
                select_clause += f"""   {v} as {k}   """
            select_sql += select_clause
        return select_sql

    def _gen_where_sql(self):
        if self.package is not None:
            self.where_clauses.append(f"   package = '{self.package}'   ")
        if self.tophash is not None:
            self.where_clauses.append(f"""   hash = '{self.tophash}'   """)
            self.where_clauses.append(f"""   hash_prefix = '{self.tophash_prefix}'   """)


        where_sql = ""
        for i, clause in enumerate(self.where_clauses):
            clause_sql = "WHERE" if i==0 else "\nAND"
            clause_sql += f" {clause}"
            where_sql += clause_sql
        return where_sql



    def _gen_sql(self):
        sql = \
f"""
{self._gen_select_sql()}
FROM "default"."metadata_service_demo" 
{self._gen_where_sql()}
"""
        return sql


    def _gen_sql_2(self):
        sql = \
f"""
WITH
manifest_table as (
  SELECT package 
  , manifest_commit_message 
  , regexp_extract("$path",'[ \w-]+?(?=\.)') AS hash
  FROM "default"."metadata_service_demo"
  WHERE logical_key IS NULL 
),
entry_table as (
  SELECT logical_key
  , package AS "entry_table_package"
  , size
  , object_hash
  , hash_prefix
  , meta
  , regexp_extract("$path", '[ \w-]+?(?=\.)') AS "entry_table_hash" 
  , replace(replace(physical_keys, '["'), '"]') as physical_key
  FROM "default"."metadata_service_demo"
  WHERE logical_key IS NOT NULL
)
{self._gen_select_sql()}
FROM entry_table
JOIN manifest_table
ON entry_table.entry_table_package = manifest_table.package 
AND entry_table.entry_table_hash = manifest_table.hash 
{self._gen_where_sql()}
"""
        return sql


    def display_sql(self):
        print(self._gen_sql_2())

    def execute(self, verbose=False):
        execution_id = query(self._gen_sql_2(), DB, OUTPUT_LOCATION)
        outcome = wait_for_query_to_complete(execution_id)
        if outcome != "SUCCEEDED":
            print(f"Query {outcome}")
            return None

        col_headers, rows = retrieve_results(execution_id)
        df = results_as_pd_dataframe(col_headers, rows)
        if verbose:
            exec_dur, data_scanned = describe_query_execution_performance(execution_id)
            print(exec_dur / 1000, "seconds,", data_scanned / 1024 / 1024, "megabytes scanned")
        return df


