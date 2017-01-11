from setuptools import setup

setup(
    name='quilt_server',
    packages=['quilt_server'],
    include_package_data=True,
    install_requires=[
        'Flask',
        'Flask-JSON',
        'Flask-Migrate',
        'Flask-OAuthlib',
        'PyMySQL',
    ],
)
