from pyathena import connect  # pylint: disable=import-self

# This file contains example code for how to query Athena via the
# PyAthena library both with and without SQLAlchemy

AWS_ACCESS_KEY = "REDACTED"
AWS_SECRET_ACCESS_KEY = "REDACTED"


def direct_access():
    cursor = connect(aws_access_key_id=AWS_ACCESS_KEY,
                     aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                     s3_staging_dir='s3://quilt-ml-data/athena/',
                     region_name='us-east-1').cursor()

    cursor.execute("SELECT * FROM default.quilt_metadata_service LIMIT 100")
    for row in cursor:
        print(row)


from sqlalchemy.engine import create_engine  # noqa: E402
from sqlalchemy.sql.schema import Table, MetaData  # noqa: E402


def main():
    conn_str = 'awsathena+rest://:@athena.us-east-1.amazonaws.com:443/' \
               'default?s3_staging_dir={s3_location}'.format(s3_location="s3://quilt-ml-data/athena/")
    engine = create_engine(conn_str)
    print("engine created")
    table = Table('quilt_metadata_service', MetaData(bind=engine), autoload=True)
    results = table.select().limit(100).execute()
    for row in results:
        print(row)
    # print(type(r))
    # print(r)
    # print(select(['*'], from_obj=many_rows).limit(100).all())


if __name__ == '__main__':
    main()
