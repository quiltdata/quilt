import boto3
import time
import pandas as pd


pd.set_option('display.width', 10000)
pd.set_option('display.max_colwidth', -1)
pd.set_option('display.max_columns', 500)
pd.set_option('display.max_rows', 500)







OUTPUT_LOCATION = "s3://quilt-ml-data/athena/demo/"
DB = "default"

class Query:
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





def query_images_containing_obj_in_split(obj='car', split='train2017'):
    q = Query(package="coco-trainval2017", tophash='5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c')
    r = q.select([
            {"count": "count(*)"}
        ]) \
        .where([
            f"""   json_array_contains(json_extract(meta, '$.user_meta.coco_meta.annotation_info["category.names"]'), '{obj}')   """,
            f"""   json_extract_scalar(meta, '$.user_meta.split') IN ('{split}')   """
        ])

    r.display_sql()
    return r

def query_packages_that_contain_obj(s3_url="s3://quilt-ml-data/data/raw/train2017/000000001164.jpg"):
    if "?versionId" in s3_url:
        print("There is a temporary bug that prevents us from matching on versionId. This will be fixed ASAP, but until "
              "then we can only check if the s3 key is used by multiple packages")
        s3_url = s3_url.split("?versionId")[0]

    q = Query()
    q = q.select([
            "package",
            "manifest_commit_message",
            "hash",
            "physical_key"
        ]) \
        .where([
            f"""   regexp_replace(physical_key, '\?.+') = '{s3_url}' """
        ])

    q.display_sql()
    return q





from textwrap import dedent


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

    @classmethod
    def __getitem__(self, key):
        return PrestoJsonSugarInstance().__getitem__(key)

    @classmethod
    def __eq__(self, other):
        return PrestoJsonSugarInstance().__eq__(other)

    @classmethod
    def contains(self, item):
        return PrestoJsonSugarInstance().contains(item)

class PrestoJsonSugarInstance:
    def __init__(self):
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

    def name_col_as(self, sql_name):
        assert isinstance(sql_name, str)
        # TODO(armand): Do better validation that this is a valid name
        chain_entry = "name_col_as", sql_name
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
                cur = f"     json_extract_scalar({cur}, '$')    "  # Whitespace to make quote marks easier to read
                cur = cur.strip()
                if isinstance(key, str):
                    sql_type = "VARCHAR"
                    key = f"    '{key}'    "  # Whitespace to make quote marks easier to read
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
            elif operation == "name_col_as":
                cur = f'{cur} AS "{key}"'
            else:
                raise NotImplementedError(operation)

            cur = dedent(cur.strip())
        return cur













if __name__ == '__main__':
    # tophash = "5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c"
    # df = Query(package="coco-trainval2017", tophash=tophash).select("logical_key", "size").where("size > 500000").run()
    # print(df)


    # print("This query shows which packages use any version of this s3 object: s3://quilt-ml-data/data/raw/train2017/000000001164.jpg")
    # print()
    # q = Query()
    # q = q.select(["package", "manifest_commit_message", "hash"]) \
    #      .where(["""regexp_replace(physical_key, '\?.+') = 's3://quilt-ml-data/data/raw/train2017/000000001164.jpg' """])
    # q.display_sql()
    # df = q.run()
    # print(df)
    # print()
    # print("---")
    # print()
    #
    #
    #
    #
    # print("This query shows the total size of the train2017 data in this package: coco-trainval2017 @ e24d422564")
    # print()
    # q = Query(package="coco-trainval2017", tophash='5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c')
    # q = q.select([{"total_size_gb": "1.0*sum(size)/1024/1024/1024"}]) \
    #      .where(["json_extract_scalar(meta, '$.user_meta.split') IN ('train2017') "])
    # results_dataframe = q.run()
    # print()
    # print(results_dataframe)
    # print()
    # print("---")
    # print()
    #
    #
    #
    # print("This query lists all COCO training images that contain car labels:")
    # q = Query(package="coco-trainval2017", tophash='5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c')
    # q = q.select([
    #     "logical_key",
    #     {"objects_in_image": """json_extract(meta, '$.user_meta.coco_meta.annotation_info["category.names"]')"""},
    #     {"split": """json_extract_scalar(meta, '$.user_meta.split')"""},
    #     "package",
    #     "physical_key"
    # ]).where([
    #     """json_array_contains(json_extract(meta, '$.user_meta.coco_meta.annotation_info["category.names"]'), 'car')""",
    #     """json_extract_scalar(meta, '$.user_meta.split') IN ('train2017') """
    # ])
    # results_dataframe = q.run()
    # print()
    # print(results_dataframe)
    # print()
    # print("---")
    # print()

    ################################################################################################

    # print("Using PrestoJsonSugar, this query shows the total size of the train2017 data in this package: "
    #       "coco-trainval2017 @ e24d422564")
    # print()
    #
    # meta = PrestoJsonSugar()
    # q = Query(package="coco-trainval2017", tophash='5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c')
    # q = q.select("sum(size)").where(meta["user_meta"]["split"] == "val2017")
    #
    # results_dataframe = q.run()
    # print()
    # print(results_dataframe)
    # print()
    # print("---")
    # print()



    meta = PrestoJsonSugar()
    print("This query lists all COCO training images that contain car labels:")

    tophash = "5708d60b8f27213ce3936d79a698916b68415e3efa0b5474d913de59f8ed999c"
    q = Query(package="coco-trainval2017", tophash=tophash)
    q = q.select([
        "logical_key",
        meta["user_meta"]["coco_meta"]["annotation_info"]["category.names"].name_col_as("objects_in_image"),
        meta["user_meta"]["split"].name_col_as("split"),
        "package",
        "physical_key"
    ]).where([
        meta["user_meta"]["coco_meta"]["annotation_info"]["category.names"].contains('car'),
        meta["user_meta"]["split"].is_in(['train2017', 'val2017'])
    ])

    q.display_sql()

    results_dataframe = q.execute()
    print()
    print(results_dataframe)
    print()
    print("---")
    print()

