from textwrap import dedent

import athena
import metadata_service


# NOTE: This is a somewhat fragile/prototypey codebase, but it provides a
# much nicer UX than the APIs in metadata_service.py. Code should be thoroughly
# reviewed before being released


class MetadataQuery:
    """User interface for querying metadata via Athena"""

    def __init__(self, bucket, package=None, tophash=None, db_name="default"):
        self.db_name = db_name
        self.bucket = bucket
        self.package = package
        self.tophash = tophash
        self.select_params = []
        self.where_clauses = []
        self.limit_val = None

    def select(self, inputs):
        """
        Support a wide variety of input arguments

        Simple string:                  select("package")
        Simple string with renaming:    select("package as pkg")
        Mapping dictionary:             select({"package": "pkg"})
        PrestoJsonSugarInstance:        select(meta["name"])
        A list of any of the above:     select([
                                            {"package": "pkg"},
                                            {meta["name"]: "name"},
                                            "size"
                                        ])
        """

        # Normalize to list
        if isinstance(inputs, (str, dict, PrestoJsonSugarInstance)):
            inputs = [inputs]

        assert isinstance(inputs, list)
        for inp in inputs:
            assert isinstance(inp, (str, dict, PrestoJsonSugarInstance))


        # Build any PrestoJsonSugarInstances to string
        for i in range(len(inputs)):
            clause = inputs[i]
            if isinstance(clause, PrestoJsonSugarInstance):
                clause = clause.build()
            if isinstance(clause, dict):
                for k in clause.keys():
                    if isinstance(clause[k], PrestoJsonSugarInstance):
                        clause[k] = clause[k].build()
            inputs[i] = clause

        # Convert various types to string representations:
        #   - strings are unchanged
        #   - dicts are converted to f"{key} AS {value}"
        for i in range(len(inputs)):
            col = inputs[i]
            if isinstance(col, str):
                continue
            elif isinstance(col, dict):
                assert len(col.keys()) == 1, "Currently only dictionaries with a single mapping are supported. Use a " \
                                             "list of dictionaries rather than a dictionary with multiple mappings"
                col_exp = col.keys()[0]
                col_name = col.values()[0]
                inputs[i] = f"{col_exp} as {col_name}"
            elif isinstance(col, PrestoJsonSugarInstance):
                raise RuntimeError("All PrestoJsonSugarInstances should have already been converted to strings. "
                                   "Something has gone very wrong")
            else:
                raise RuntimeError(f"Unexpected select input type {type(col)}")

        self.select_params = inputs
        return self


    def where(self, where_clauses):
        if isinstance(where_clauses, (str, PrestoJsonSugarInstance)):
            where_clauses = [where_clauses]

        assert isinstance(where_clauses, list)
        for p in where_clauses:
            assert isinstance(p, (str, PrestoJsonSugarInstance)), f"Unexpected where clause type: {type(p)}"

        # Build where clauses that use PrestoJsonSugarInstance
        for i in range(len(where_clauses)):
            clause = where_clauses[i]
            if isinstance(clause, PrestoJsonSugarInstance):
                clause = clause.build()
            where_clauses[i] = clause

        for where_clause in where_clauses:
            assert isinstance(where_clause, str), f"All where clauses should have been converted to strings. " \
                                                  f"Something has gone very wrong as we received a where clause of " \
                                                  f"type: {type(where_clause)}"
        self.where_clauses = where_clauses
        return self

    def limit(self, limit_val: int):
        assert isinstance(limit_val, int)
        self.limit_val = limit_val
        return self


    def _gen_select_sql(self):
        """Convert select_clauses into a single SELECT string"""
        return "SELECT " + "\n, ".join(self.select_params)


    def _gen_where_sql(self):
        if self.package is not None:
            usr, pkg = self.package.split("/")
            self.where_clauses.append(f"   usr = '{usr}'   ")
            self.where_clauses.append(f"   pkg = '{pkg}'   ")
        if self.tophash is not None:
            self.where_clauses.append(f"""   hash = '{self.tophash}'   """)
            self.where_clauses.append(f"""   hash_prefix = '{self.tophash[:2]}'   """)


        where_sql = ""
        for i, clause in enumerate(self.where_clauses):
            clause_sql = "WHERE" if i==0 else "\nAND"
            clause_sql += f" {clause}"
            where_sql += clause_sql
        return where_sql

    def _gen_limit_sql(self):
        if self.limit_val is None:
            return ""

        return f"LIMIT {self.limit_val}"

    def _gen_sql(self):
        sql = f"""\
{self._gen_select_sql()}
FROM "{self.db_name}"."{metadata_service.view_name(self.bucket)}" 
{self._gen_where_sql()}
{self._gen_limit_sql()}"""


        return sql



    def display_sql(self):
        print(self._gen_sql())

    def execute(self, verbose=False):
        col_headers, rows = metadata_service.query(self._gen_sql(), self.bucket, self.db_name, verbose=verbose)
        df = athena.results_as_pandas_dataframe(col_headers, rows)
        return df







def python_var_to_sql_str(v):
    assert isinstance(v, (str, int, float)), "Can only convert str/int/float to SQL str"
    if isinstance(v, str):
        v = f"    '{v}'    "  # Whitespace to make quote marks easier to read
        v = v.strip()
    return v

def list_to_sql(list_or_tuple):
    sql_items = [python_var_to_sql_str(v) for v in list_or_tuple]
    return f"({', '.join(sql_items)})"


class PrestoJsonSugar:
    """
    This class exists to improve the UX of PrestoJsonSugarInstance so that you can do:

        meta = PrestoJsonSugar()
        meta["key1"] == "value1"
        meta["key2"].is_in(["val2", "val3", "val4"])

    instead of:

        meta = PrestoJsonSugarInstance
        meta()["key1"] == "value1"
        meta()["key2"].is_in(["val2", "val3", "val4"])

    Code is prototype-style so needs to be seriously reviewed before release

    """

    @classmethod
    def __getitem__(cls, key):
        return PrestoJsonSugarInstance().__getitem__(key)

    @classmethod
    def __eq__(cls, other):
        return PrestoJsonSugarInstance().__eq__(other)

    @classmethod
    def contains(cls, item):
        return PrestoJsonSugarInstance().contains(item)

class PrestoJsonSugarInstance:
    """
    A class to construct Presto JSON SQL from code that looks like normal
    python dictionary expressions. Each dictionary style access adds a new
    (operation, value) tuple to self.chain.

    build() then converts the chain into Presto SQL

    Code is prototype-style so needs to be seriously reviewed before release
    """
    def __init__(self):
        """ Maintain an internal list of (operation, value) tuples that can be converted into Presto SQL"""
        self.chain = []

    def __getitem__(self, key):
        assert isinstance(key, str), "Dictionary access must use string keys. List access is not currently implemented"
        chain_entry = "extract", key
        self.chain.append(chain_entry)
        return self

    def __eq__(self, value):
        assert isinstance(value, (str, int, float)), "Only str/int/float are currently supported for equality"
        chain_entry = "eq", value
        self.chain.append(chain_entry)
        return self

    def __repr__(self):
        return str(self.chain)

    def contains(self, item):
        assert isinstance(item, (str, int, float)), "Only str/int/float are currently supported for contains"
        chain_entry = "contains", item
        self.chain.append(chain_entry)
        return self

    def is_in(self, list_or_tuple):
        assert isinstance(list_or_tuple, (list, tuple))
        chain_entry = "in_list", list_or_tuple
        self.chain.append(chain_entry)
        return self


    def build(self):
        cur = "meta"
        for operation, key in self.chain:
            if operation == "extract":
                assert isinstance(key, str)
                cur = f"""\
                json_extract({cur}, '$["{key}"]') \
                """
            elif operation == "eq":
                cur = f"  json_extract_scalar({cur}, '$')  "
                cur = cur.strip()
                if isinstance(key, str):
                    sql_type = "VARCHAR"
                    key = f"  '{key}'  "  # Whitespace to make quote marks easier to read
                    key = key.strip()
                elif isinstance(key, int):
                    sql_type = "INTEGER"
                elif isinstance(key, float):
                    sql_type = "DOUBLE"
                else:
                    raise NotImplementedError(f"Equality cannot handle type {type(key)}")

                cur = f"CAST({cur} AS {sql_type}) = {key}"

            elif operation == "contains":
                cur = f"json_array_contains({cur}, {python_var_to_sql_str(key)})"
            elif operation == "in_list":
                cur = f"json_extract_scalar({cur}, '$') IN {list_to_sql(key)}"
            else:
                raise NotImplementedError(operation)

            cur = dedent(cur.strip())
        return cur

    @property
    def sqlalchemy_engine(self):
        raise NotImplementedError

    @property
    def pyathena_connection(self):
        raise NotImplementedError


if __name__ == '__main__':
    verbose = True
    bucket = "armand-dotquilt-dev"
    db_name = "default2"
    package = "test/glue"
    metadata_service.setup(bucket, db_name, verbose=verbose)

    query = MetadataQuery(
        bucket=bucket,
        package=package,
        tophash="1a527eccc30d9a775e3c06031190a76de7263047543b31c5d8136273ba793476",
        db_name=db_name
    ).select([
        "logical_key",
        "physical_key",
        "size",
        "object_hash_type",
        "object_hash",
        "package",  # Package name
        "manifest_commit_message",
        "hash",  # manifest top hash
        "meta"  # user defined metadata for each logical_key (work with meta using Presto JSON tools or PrestoJsonSugar class)
    ]).where([
        "size > 1000000"
    ]).limit(
            100
    )

    pd_df = query.execute(verbose=True)



    # meta = PrestoJsonSugar()
    # tophash = "5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c"
    # q = MetadataQuery(bucket=bucket, package=package, tophash=tophash)
    # q = q.select([
    #     "logical_key",
    #     {meta["user_meta"]["coco_meta"]["annotation_info"]["category.names"]: "objects_in_image"},
    #     {meta["user_meta"]["split"]: "split"},
    #     "package",
    #     "physical_key"
    # ]).where([
    #     meta["user_meta"]["coco_meta"]["annotation_info"]["category.names"].contains('car'),
    #     meta["user_meta"]["split"].is_in(['train2017', 'val2017'])
    # ])
