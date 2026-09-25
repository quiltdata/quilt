Create a new package search method `search_meta` as a class method in the quilt3.Package class that searches for Quilt packages only, and searches based on package metadata.

Search_meta will call the graphql endpoint in the Quilt registry. Code for the quilt registry is in: /Users/kmoore/toa/github/enterprise/registry/quilt_server.

Inputs:
- A bucket or set of s3 buckets to search. Quilt maintains separate elasticsearch indexes for each s3 bucket.
- A dict of metadata fields and values. It should return the names of packages that have an exact match of all of the metadata field/value pairs in the input dict.

Return:
- a list of package names of all the packages that have an exact match of all of the metadata field/value pairs in the input dict found in the selected s3 buckets.

Test environment:
- Use the virtual environment quilt3 for Python execution and testing. The venv folder is located in /Users/kmoore/venvs/quilt3
- Use the quilt stack at demo.quiltdata.com for testing.

Instructions:
- Ask for clarifications if anything is unclear
- Fail loudly. Our goal is to find problems and debug them, not to implement work arounds. Do not use workarounds, or fall back options.