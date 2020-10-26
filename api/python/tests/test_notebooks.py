import shutil
import subprocess
from pathlib import Path

from tests.utils import QuiltTestCase
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


class NotebookFilesHandler(FileSystemEventHandler):

    def __init__(self):
        self.new_files = []

    def on_created(self, event):
        print("on_created", event.src_path)
        self.new_files.append(Path(event.src_path))

    def clean_up(self):
        """Delete newly created files and directories."""
        print("deleting newly created files and directories...")
        for path in self.new_files:
            if path.exists():
                if path.is_file():
                    path.unlink()
                else:
                    shutil.rmtree(path)


def execute_notebook(notebook):
    """Execute a given notebook in a sub shell."""
    set_config_cmd = [
        'quilt3',
        'config',
        '--set',
        'navigator_url=https://example.com',
        'apiGatewayEndpoint=https://xyz.execute-api.us-east-1.amazonaws.com/prod',
        'binaryApiGatewayEndpoint=https://xyz.execute-api.us-east-1.amazonaws.com/prod',
        'default_remote_registry=s3://example/',
        'defaultBucket=test-bucket',
        'registryUrl=https://registry.example.com',
        's3Proxy=open-s3-proxy.quiltdata.com'
    ]
    subprocess.run(set_config_cmd, check=True)
    cmd = ['jupyter', 'nbconvert', '--to', 'notebook', '--execute', str(notebook)]
    subprocess.run(cmd, check=True)


class NotebookDocumentationTestCase(QuiltTestCase):

    @classmethod
    def setUpClass(cls):
        cwd = Path(__file__).parent
        cls.quilt_path = list(cwd.parts)[:-3]
        cls.handler = NotebookFilesHandler()
        cls.observer = Observer()

        path_to_watch = str(Path(*cls.quilt_path) / 'docs')
        cls.observer.schedule(cls.handler, path=path_to_watch, recursive=True)
        cls.observer.start()

    @classmethod
    def tearDownClass(cls):
        """Stop observer to clean up resource"""
        cls.observer.stop()
        cls.observer.join()

    def tearDown(self):
        """Delete created files/directories after each notebook run."""
        super().tearDown()
        self.handler.clean_up()

    def test_working_with_manifests_notebook(self):
        docs_path = Path(*self.quilt_path) / 'docs/Advanced Features/'
        notebook = docs_path / 'Working with Manifests.ipynb'
        execute_notebook(notebook)

        assert (docs_path / 'data.csv').exists()
        assert (docs_path / 'example.jsonl').exists()
        assert (docs_path / 'Working with Manifests.nbconvert.ipynb').exists()

    def test_editing_a_package_notebook(self):
        docs_path = Path(*self.quilt_path) / 'docs/Walkthrough/'
        notebook = docs_path / 'Editing a Package.ipynb'
        execute_notebook(notebook)

        assert (docs_path / 'data.csv').exists()
        assert (docs_path / 'data/').is_dir()
        assert (docs_path / 'Editing a Package.nbconvert.ipynb').exists()

    def test_getting_data_from_a_package_notebook(self):
        docs_path = Path(*self.quilt_path) / 'docs/Walkthrough/'
        notebook = docs_path / 'Getting Data from a Package.ipynb'
        execute_notebook(notebook)

        assert (docs_path / 'QuickStart.ipynb').exists()
        assert (docs_path / '.quiltignore').exists()
        assert (docs_path / 'quilt_summarize.json').exists()
        assert (docs_path / 'scripts').is_dir()
        assert (docs_path / 'notebooks').is_dir()
        assert (docs_path / 'references').is_dir()
        assert (docs_path / 'Getting Data from a Package.nbconvert.ipynb').exists()

    def test_installing_a_package_notebook(self):
        docs_path = Path(*self.quilt_path) / 'docs/Walkthrough/'
        notebook = docs_path / 'Installing a Package.ipynb'
        execute_notebook(notebook)

        assert (docs_path / 'quilt_summarize.json').exists()
        assert (docs_path / 'notebooks').is_dir()
        assert (docs_path / 'scripts').is_dir()
        assert (docs_path / 'data').is_dir()
        assert (docs_path / 'Installing a Package.nbconvert.ipynb').exists()

    def test_uploading_a_package_notebook(self):
        docs_path = Path(*self.quilt_path) / 'docs/Walkthrough/'
        notebook = docs_path / 'Uploading a Package.ipynb'
        execute_notebook(notebook)

        assert (docs_path / 'Uploading a Package.nbconvert.ipynb').exists()

    def test_working_with_a_bucket_notebook(self):
        docs_path = Path(*self.quilt_path) / 'docs/Walkthrough/'
        notebook = docs_path / 'Working with a Bucket.ipynb'
        execute_notebook(notebook)

        assert (docs_path / 'read.md').exists()
        assert (docs_path / 'aleksey').is_dir()
        assert (docs_path / 'aleksey/quilt_summarize.json').exists()
        assert (docs_path / 'aleksey/data').is_dir()
        assert (docs_path / 'aleksey/notebooks').is_dir()
        assert (docs_path / 'aleksey/scripts').is_dir()
        assert (docs_path / 'Working with a Bucket.nbconvert.ipynb').exists()
