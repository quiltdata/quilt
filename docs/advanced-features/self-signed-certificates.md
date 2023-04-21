<!-- markdownlint-disable-next-line first-line-h1 -->
To use a self-signed certificate with the `quilt3` API or CLI,
the certificate must first be added to your Python environment.

## Mac and Linux

1. Determine the location of your certificates:
    ```python
    >>> import certifi
    >>> certifi.where()
    '/path/to/site-packages/certifi/cacert.pem'
    ```
2. Copy your custom self-signed certificate and paste into the
`cacert.pem` file.

## Windows

1. Press «Win + R» to open a new command prompt and type `certmgr`.
This opens the Windows Certificate Manager for the current user.
2. Search all certificates stores for a certificate issued by `mitm`.
There should be at least one certificate.

   ![MITM certificate](../imgs/certmgr-windows.png)

3. Export the certificate in Base-64 encoded X.509 (.CER) to your
file system (`Path\To\mitm.cer`)
4. Add the certificate to the list of trusted CA's via the
`REQUESTS_CA_BUNDLE` environment variable:
    ```bash
    > set REQUESTS_CA_BUNDLE=Path\To\mitm.cer
    ```

## Verification
Requesting access to a private website should now return a 200 HTTP
status code:

```python
import requests

requests.get('https://PATH_TO_PRIVATE_WEBSITE')
<Response [200]>
```
