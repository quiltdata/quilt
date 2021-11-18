import base64
import json
import os
import subprocess
import tempfile
import urllib.request


def lambda_handler(event, context):
    # TODO implement
    print(event)
    with tempfile.TemporaryDirectory() as tmp_dir:
        file_name_base = 'file'
        output_ext = 'png'
        src_file_path = os.path.join(tmp_dir, f'{file_name_base}.pptx')
        with open(src_file_path, 'xb') as src_file:
            with urllib.request.urlopen(event) as url_obj:
                src_file.write(url_obj.read())
        
        subprocess.run(
            ('/opt/libreoffice7.2/program/simpress', '--convert-to', output_ext, '--outdir',  tmp_dir, src_file_path), 
            check=True,
            env={
                'HOME': tmp_dir,
            },
        )
        
        
        with open(os.path.join(tmp_dir, f'{file_name_base}.{output_ext}'), 'rb') as out_file:
            out_data = out_file.read()
        
        
    return {
        'statusCode': 200,
        'body': base64.b64encode(out_data).decode(),
    }
