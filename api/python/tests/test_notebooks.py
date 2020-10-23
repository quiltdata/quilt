import shutil
import subprocess
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer


class NotebookFilesHandler(FileSystemEventHandler):

    def __init__(self):
        self.new_files = []

    def on_created(self, event):
        print("on_created", event.src_path)
        self.new_files.append(Path(event.src_path))

    def clean_up(self):
        print("cleaning up files...")
        for path in self.new_files:
            if path.exists():
                if path.is_file():
                    path.unlink()
                else:
                    shutil.rmtree(path)


def test_walk_through_notebooks():
    cwd = Path(__file__).parent
    docs_path = list(cwd.parts)[:-3]
    paths = [Path(*docs_path) / 'docs/Walkthrough/Editing a Package.ipynb', ]

    handler = NotebookFilesHandler()
    observer = Observer()

    try:
        # start watcher for path 'docs'
        path_to_watch = str(Path(*docs_path) / 'docs')
        observer.schedule(handler, path=path_to_watch, recursive=True)
        observer.start()

        for path in paths:
            path = str(path).replace(' ', '\\ ')
            cmd = f"jupyter nbconvert --to notebook --execute {path}"
            subprocess.call(cmd, shell=True)

            # delete created files after each notebook run
            handler.clean_up()

        # stop observer to clean up resource
        observer.stop()
    except KeyboardInterrupt:
        # stop observer and cleanup on keyboard interruption
        observer.stop()
        handler.clean_up()
