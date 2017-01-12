from setuptools import setup

setup(
    name='quilt_server',
    packages=['quilt_server'],
    include_package_data=True,
    install_requires=[
        'flask',
        'flask-json',
        'flask-migrate',
        'pymysql',
    ],
)
