"""
Test functions for preview endpoint
"""
import json
import pathlib
import re
import os

from unittest.mock import ANY, patch
import responses

from .. import index

MOCK_ORIGIN = 'http://localhost:3000'

BASE_DIR = pathlib.Path(__file__).parent / 'data'

# pylint: disable=no-member,invalid-sequence-index
class TestIndex():
    """Class to test various inputs to the main indexing function"""
    FILE_URL = 'https://quilt-example.s3.amazonaws.com/file.ext'
    # pylint: disable=too-many-function-args
    # pylint hates on index.lambda_handler(event, None), even though, without the
    # second arg we would get TypeError: wrapper() missing 1 required positional argument: '_'
    @classmethod
    def _make_event(cls, query, headers=None):
        return {
            'httpMethod': 'POST',
            'path': '/foo',
            'pathParameters': {},
            'queryStringParameters': query or None,
            'headers': headers or None,
            'body': None,
            'isBase64Encoded': False,
        }

    def test_bad(self):
        """send a known bad event (no input query parameter)"""
        event = self._make_event({'url': self.FILE_URL}, {'origin': MOCK_ORIGIN})
        resp = index.lambda_handler(event, None)
        assert resp['statusCode'] == 400, 'Expected 400 on event without "input" query param'
        assert resp['body'], 'Expected explanation for 400'
        assert resp['headers']['access-control-allow-origin'] == '*'

    def test_bad_hostname(self):
        bad_url = 'https://example.com/foo'
        event = self._make_event({'url': bad_url, 'input': 'txt'}, {'origin': MOCK_ORIGIN})
        resp = index.lambda_handler(event, None)
        assert resp['statusCode'] == 400, 'Expected 400 on event with a non-S3 URL'
        body = json.loads(resp['body'])
        assert 'S3' in body['title'], 'Expected 400 explanation'

    def test_bad_line_count(self):
        """send a known bad line_count parameter"""
        garbage = '-1'
        event = self._make_event({
            'url': self.FILE_URL,
            'input': 'txt',
            'line_count': garbage}, {'origin': MOCK_ORIGIN})
        resp = index.lambda_handler(event, None)
        assert resp['statusCode'] == 400, f'Expected 400 on event with line_count of {garbage}'
        body = json.loads(resp['body'])
        assert 'Unexpected line_count=' in body['title'], 'Expected 400 explanation'
        assert 'out of range' in body['detail'], 'Expected 400 explanation'

        garbage = '123notint'
        event = self._make_event({
            'url': self.FILE_URL,
            'input': 'txt',
            'line_count': garbage}, {'origin': MOCK_ORIGIN})
        resp = index.lambda_handler(event, None)
        assert resp['statusCode'] == 400, 'Expected 400 on event with line_count of 123notint'
        body = json.loads(resp['body'])
        assert 'Unexpected line_count=' in body['title'], 'Expected 400 explanation'
        assert 'invalid literal' in body['detail'], 'Expected 400 explanation'

    @responses.activate
    def test_csv(self):
        """test returning HTML previews of CSV (via pandas)"""
        csv = BASE_DIR / 'sample.csv'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=csv.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'csv'})
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, 'preview failed on sample.csv'
        body_html = body['html']
        assert body_html.count('<table') == 1, 'expected one HTML table'
        assert body_html.count('</table>') == 1, 'expected one HTML table'
        assert body_html.count('<p>') == body_html.count('</p>'), 'malformed HTML'
        assert not re.match(r'\d+ rows × \d+ columns', body_html), \
            'table dimensions should be removed'
        with open(BASE_DIR / 'csv_html_response_head.txt') as expected:
            head = expected.read()
            assert head in body_html, 'unexpected first columns'

    @responses.activate
    def test_excel(self):
        """test parsing excel files in S3"""
        workbook = BASE_DIR / 'sample.xlsx'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=workbook.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'excel'})
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, 'preview failed on sample.xlsx'
        body_html = body['html']
        assert '700 rows' in body_html, 'unexpected row count'
        assert '16 columns' in body_html, 'unexpected column count'
        assert body_html.count('Germany') == 14, 'unexpected data contents'
        assert body_html.count('Enterprise') == 7, 'unexpected data contents'
        assert body_html.count('Midmarket') == 16, 'unexpected data contents'
        assert body_html.count('Canada') == 14, 'unexpected data contents'

    @responses.activate
    def test_ipynb(self):
        """test sending ipynb bytes"""
        notebook = BASE_DIR / 'nb_1200727.ipynb'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=notebook.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'ipynb'})
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, 'preview failed on nb_1200727.ipynb'
        body_html = body['html']

        # neither lxml, nor py_w3c.validators.html.validator works to validate
        # these fragments; reasons include base64 encoded images, html entities, etc.
        # so we are going to trust nbconvert and just do some basic sanity checks
        # it is also the case that we (often) need to update nbconvert, and
        # HTML output changes version over version, so checking for exact HTML
        # is fragile
        assert body_html.count('<div') > 0, 'expected divs in ipynb HTML'
        assert body_html.count('<div') == body_html.count('</div>')
        assert body_html.count('<span') > 0, 'expected spans in ipynb HTML'
        assert body_html.count('<span') == body_html.count('</span>')
        # check for some strings we know should be in there
        assert 'SVD of Minute-Market-Data' in body_html, 'missing expected contents'
        assert 'Preprocessing' in body_html, 'missing expected contents'
        assert '<pre>[&#39;SEE&#39;, &#39;SE&#39;, &#39;SHW&#39;, &#39;SIG&#39;,' in body_html, \
            'Cell 3 output seems off'
        assert '<span class="n">batch_size</span><span class="o">=</span><span class="mi">100</span><span class="p">' in body_html, \
            'Last cell output missing'

    @responses.activate
    def test_ipynb_exclude(self):
        """test sending ipynb bytes"""
        notebook = BASE_DIR / 'nb_1200727.ipynb'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=notebook.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'ipynb', 'exclude_output': 'true'})
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, 'preview failed on nb_1200727.ipynb'
        body_html = body['html']
        # neither lxml, nor py_w3c.validators.html.validator works to validate
        # these fragments; reasons include base64 encoded images, html entities, etc.
        # so we are going to trust nbconvert and just do some basic sanity checks
        # it is also the case that we (often) need to update nbconvert, and
        # HTML output changes version over version, so checking for exact HTML
        # is fragile
        assert body_html.count('<div') > 0, 'expected divs in ipynb HTML'
        assert body_html.count('<div') == body_html.count('</div>')
        assert body_html.count('<span') > 0, 'expected spans in ipynb HTML'
        assert body_html.count('<span') == body_html.count('</span>')
        # check for some strings we know should be in there
        assert 'SVD of Minute-Market-Data' in body_html, 'missing expected contents'
        assert 'Preprocessing' in body_html, 'missing expected contents'
        assert '<pre>[&#39;SEE&#39;, &#39;SE&#39;, &#39;SHW&#39;, &#39;SIG&#39;,' not in body_html, \
            'Unexpected output cell; exclude_output:true was given'
        assert '<span class="n">batch_size</span><span class="o">=</span><span class="mi">100</span><span class="p">' in body_html, \
            'Last cell output missing'
        assert len(body_html.encode()) < 19_000, \
            'Preview larger than expected; exclude_output:true was given'

    @responses.activate
    def test_parquet(self):
        """test sending parquet bytes"""
        parquet = BASE_DIR / 'atlantic_storms.parquet'
        info_response = BASE_DIR / 'parquet_info_response.json'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=parquet.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'parquet'})
        resp = index.lambda_handler(event, None)
        assert resp['statusCode'] == 200, f'Expected 200, got {resp["statusCode"]}'
        body = json.loads(resp['body'])
        with open(info_response, 'r') as info_json:
            expected = json.load(info_json)
        assert (body['info'] == expected), \
            f'Unexpected body["info"] for {parquet}'

    @responses.activate
    def test_tsv(self):
        """test returning HTML previews of TSV (via pandas)"""
        csv = BASE_DIR / 'avengers.tsv'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=csv.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'csv', 'sep': '\t'})
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, f'preview failed on {csv}'
        body_html = body['html']
        assert body_html.count('<table') == 1, 'expected one HTML table'
        assert body_html.count('</table>') == 1, 'expected one HTML table'
        assert body_html.count('<thead>') == 1, 'expected one HTML table head'
        assert body_html.count('</thead>') == 1, 'expected one HTML table head'
        assert body_html.count('<p>') == body_html.count('</p>'), 'malformed HTML'
        assert '<td>Nicholas Fury, Jr., Marcus Johnson</td>' in body_html, \
            'Expected Nick to be an Avenger'
        assert not re.match(r'\d+ rows × \d+ columns', body_html), \
            'table dimensions should be removed'
        with open(BASE_DIR / 'tsv_html_response_head.txt') as expected:
            head = expected.read()
            assert head in body_html, 'unexpected first columns'

    @responses.activate
    def test_tsv_as_csv(self):
        """test returning HTML previews of mislabeled or problematic CSVs (via pandas)"""
        csv = BASE_DIR / 'tsv_mixed_types.csv'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=csv.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'csv'})
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, f'preview failed on {csv}'
        body_html = body['html']
        assert body_html.count('<table') == 1, 'expected one HTML table'
        assert body_html.count('</table>') == 1, 'expected one HTML table'
        assert body_html.count('<thead>') == 1, 'expected one HTML table head'
        assert body_html.count('</thead>') == 1, 'expected one HTML table head'
        assert body_html.count('<p>') == body_html.count('</p>'), 'malformed HTML'
        assert '<td>Taiwan Strait, Taiwan (general), Taiwan</td>' in body_html, \
            'Missing a cell on the Taiwan Strait'
        assert not re.match(r'\d+ rows × \d+ columns', body_html), \
            'table dimensions should be removed'
        with open(BASE_DIR / 'tsv_mixed_types_html_response_head.txt') as expected:
            head = expected.read()
            assert head in body_html, 'unexpected first columns'

    @responses.activate
    def test_no_meta_parquet(self):
        """test a parquet file with no meta.metadata"""
        no_meta_parquet = BASE_DIR / 'no_meta.parquet'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=no_meta_parquet.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'parquet'})
        resp = index.lambda_handler(event, None)

        assert resp['statusCode'] == 200, f'Expected 200, got {resp["statusCode"]}'

    @responses.activate
    @patch(__name__ + '.index.get_preview_lines')
    def test_txt_max_count(self, get_preview_lines):
        """test truncation to line_count"""
        responses.add(
            responses.GET,
            self.FILE_URL,
            body='foo',
            status=200)
        for count in (1, 44, 19):
            get_preview_lines.reset_mock()
            get_preview_lines.return_value = []
            event = self._make_event({'url': self.FILE_URL, 'input': 'txt', 'line_count': str(count)})
            resp = index.lambda_handler(event, None)
            assert resp['statusCode'] == 200, 'preview lambda failed'
            get_preview_lines.assert_called_with(ANY, None, count, index.CATALOG_LIMIT_BYTES)

    @responses.activate
    @patch(__name__ + '.index.get_preview_lines')
    def test_txt_count_gz(self, get_preview_lines):
        """test truncation to line_count for a zipped file"""
        responses.add(
            responses.GET,
            self.FILE_URL,
            body='foo',
            status=200)
        for count in (9, 232, 308):
            get_preview_lines.reset_mock()
            get_preview_lines.return_value = []
            event = self._make_event({
                'url': self.FILE_URL,
                'input': 'txt', 'line_count': str(count),
                'compression': 'gz'})
            resp = index.lambda_handler(event, None)
            assert resp['statusCode'] == 200, 'preview lambda failed'
            get_preview_lines.assert_called_with(ANY, 'gz', count, index.CATALOG_LIMIT_BYTES)


    @responses.activate
    def test_txt_short(self):
        """test sending txt bytes"""
        txt = BASE_DIR / 'short.txt'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=txt.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'txt'})
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, 'preview lambda failed on short.txt'
        headlist = body['info']['data']['head']
        assert len(headlist) == 98, 'unexpected number of lines head'
        assert headlist[0] == 'Line 1', 'unexpected first line in head'
        assert headlist[97] == 'Line 98', 'unexpected last line in head'
        taillist = body['info']['data']['tail']
        assert not taillist, 'expected empty tail'

    @responses.activate
    def test_vcf(self):
        """test sending vcf bytes"""
        vcf = BASE_DIR / 'example.vcf'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=vcf.read_bytes(),
            status=200)
        event = self._make_event({'url': self.FILE_URL, 'input': 'vcf'})
        resp = index.lambda_handler(event, None)
        _check_vcf(resp)

    @responses.activate
    def test_vcf_gz(self):
        """test sending vcf bytes (zipped)"""
        vcf = BASE_DIR / 'example.vcf.gz'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=vcf.read_bytes(),
            status=200)
        event = self._make_event(
            {'url': self.FILE_URL, 'input': 'vcf', 'compression': 'gz'})
        resp = index.lambda_handler(event, None)
        _check_vcf(resp)

    # 513 = 128*4 + 1 => ensure there's a partial chunk in play
    @patch(__name__ + '.index.CATALOG_LIMIT_BYTES', 513)
    @patch(__name__ + '.index.CHUNK', 128)
    @responses.activate
    def test_vcf_gz_partial(self):
        """test previewing part of a gzipped file
        we _should_ read 4 whole chunks and one partial one;
        and the preview endpoint should truncate to the last whole line
        """
        vcf = BASE_DIR / 'example.vcf.gz'
        assert os.path.getsize(vcf) > 128*5, 'not testing partial file decode'
        responses.add(
            responses.GET,
            self.FILE_URL,
            body=vcf.read_bytes(),
            status=200)
        event = self._make_event(
            {'url': self.FILE_URL, 'input': 'vcf', 'compression': 'gz'})
        # test partial decode
        resp = index.lambda_handler(event, None)
        body = json.loads(resp['body'])
        assert resp['statusCode'] == 200, 'preview failed on example.vcf.gz, partial decode'
        data = body['info']['data']
        assert not data['data'], 'partial decode; did not expect any data'
        assert not data['header'], 'partial decode; did not expect a header'
        assert data['meta'][0] == '##fileformat=VCFv4.0', 'bad first meta line'
        assert data['meta'][-1].startswith('##FILTER=<'), 'bad last meta line'
        assert data['meta'][-1].endswith('samples have data">'), 'bad last meta line'
        meta = body['info']['metadata']
        assert meta['variant_count'] == 0, 'expected no variants'
        assert not body['info']['metadata']['variants'], 'expected no variants'

def _check_vcf(resp):
    """common logic for checking vcf files, e.g. across compression settings"""
    body = json.loads(resp['body'])
    assert resp['statusCode'] == 200, 'preview failed on example.vcf, or a compressed version of it'
    assert body['info']['metadata']['variant_count'] == 3, 'expected 3 variants'
    data = body['info']['data']
    assert data['meta'][0] == '##fileformat=VCFv4.0', 'unexpected meta first line'
    assert data['meta'][5].startswith('##INFO=<ID=NS,Number=1,Type=Integer,Desc'), \
        'unexpected meta fifth line'
    assert data['meta'][5].endswith('"Number of Samples With Data">'), \
        'unexpected meta fifth line'
    assert data['header'] == ['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO', 'FORMAT'], \
        'unexpected header'
    assert len(data['header']) == index.MIN_VCF_COLS + 1, 'unexpected number of columns'
    assert body['info']['metadata']['variants'] == ['NA00001', 'NA00002', 'NA00003'], \
        'unexpected variants'
    assert len(data['data'][0]) == index.MIN_VCF_COLS + 1, 'unexpected number of columns'
    assert data['data'][0] == ['20', '14370', 'rs6054257', 'G', 'A', '29', 'PASS', 'NS=3;DP=14;AF=0.5;DB;H2', 'GT:GQ:DP:HQ'], \
        'unexpected first data line'
    assert data['data'][-1] == ['20', '1234567', 'microsat1', 'GTCT', 'G,GTACT', '50', 'PASS', 'NS=3;DP=9;AA=G', 'GT:GQ:DP'], \
        'unexpected first data line'
