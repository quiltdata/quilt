from .util import QuiltException
import data_transfer

LATEST_TAG = "latest"
VALID_README_EXTENSIONS = ["md", "txt", "rtf", "rst", "ipynb", None]

def get_s3_object(bucket, key):
    return bytes()




class QuiltRegistry:
    def __init__(self): pass

    @staticmethod
    def packages(): pass  # View all installed Packages along with disk usage for each

    @staticmethod
    def status(pkg): pass  # Is pkg installed? If yes, what is and isn't cached?



class Manifest:
    """
    Class to abstract .quilt/ layout in s3
    """
    @staticmethod
    def get_hash_from_tag(pkg_name, tag):
        bucket = Package.extract_bucket_from_pkg_name(pkg_name)
        key = Manifest.s3_key_for_tag(pkg_name, tag)
        pkg_hash = get_s3_object(bucket, key).decode("utf-8")
        return pkg_hash


    @staticmethod
    def s3_key_for_full_manifest(pkg_name, pkg_hash):
        pass

    @staticmethod
    def s3_key_for_fast_manifest(pkg_name, pkg_hash):
        pass

    @staticmethod
    def s3_key_for_metadata_chunk(pkg_name, pkg_hash, logical_key):
        pass

    @staticmethod
    def s3_key_for_tag(pkg_name, tag):
        pass


class Cache:
    @staticmethod
    def get_full_manifest(pkg_name, pkg_hash):
        # Return (package_metadata_JSON, list_of_entry_JSONs)
        return {}, []
        pass

    @staticmethod
    def get_fast_manifest(pkg_name, pkg_hash):
        # Return (package_metadata_JSON, list_of_entry_JSONs)
        return {}, []


    @staticmethod
    def get_metadata_for_entry(pkg_name, pkg_hash, logical_key):
        # Return metadata as JSON
        pass


class Package:
    def __init__(self, pkg_name, pkg_hash=None, tag=None):
        """
        Download enough of the manifest so that a user can start working with it. Other pieces can be JIT downloaded,
        but the core list of PackageEntries should be populated.

        TODO(PERF): This method needs to be performance tested to ensure that exploring a dataset does not feel slow
        """
        self.name = pkg_name
        self.bucket = Package.extract_bucket_from_pkg_name(self.name)

        # If only a pkg_name if given, default to latest tag
        if pkg_hash is None and tag is None:
            tag = LATEST_TAG

        # If the user passed in a tag, find the matching hash.
        if tag is not None:
            try:
                hash_for_tag = Manifest.get_hash_from_tag(self.name, tag)
            except Exception as ex:
                raise ex  # TODO: Improve UX. Most common exception is probably lack of S3 permissions

            # If the user also passed in pkg_hash, make sure they match
            if pkg_hash is not None:
                # TODO: Assertion errors are not customer friendly
                assert hash_for_tag == pkg_hash, f"You specified both a tag and a pkg_hash. Currently, tag " \
                                                 f"'{tag}' points to hash {hash_for_tag}, which does not match " \
                                                 f"the hash you specified ({pkg_hash}). You can pass in just the tag."
            pkg_hash = hash_for_tag

        # Now we have pkg_name and pkg_hash which are enough for us to download the Fast Manifest
        self._hash = pkg_hash

        # Download fast manifest, set Package metadata, create PackageEntries
        manifest_metadata_json, manifest_entry_jsons = Cache.get_fast_manifest(self.name, self._hash)
        self._metadata = manifest_metadata_json
        self._entries = []
        for manifest_entry_json in manifest_entry_jsons:
            pkg_entry = PackageEntry(
                    pkg_name=self.name,
                    pkg_hash=self._hash,
                    logical_key=manifest_entry_json["logical_key"],
                    physical_key=manifest_entry_json["physical_key"],
                    size=manifest_entry_json["size"],
                    entry_hash=manifest_entry_json["hash"]["value"],
                    metadata=manifest_entry_json["meta"]
            )
            self._entries.append(pkg_entry)












    @property
    def pkg_hash(self):
        return self._hash

    @property
    def metadata(self):
        return self._metadata

    def download_data(self, loc=None): pass

    def verify(self, loc=None): pass  # Confirm that the downloaded data matches the manifest

    def push(self, tag=None):
        # Generate/get the Fast Manifest, Full Manifest, Metadata Chunks and push them to s3.
        # May eventually want to trigger an Athena Recover Partitions, but we will see.
        pass

    def get_entry(self, logical_key):
        """
        TODO(PERF): This has good space complexity, but poor time complexity. Need to test on a large manifest
        """
        entries = [e for e in self._entries if e.logical_key == logical_key]
        # TODO: AssertionErrors are customer unfriendly
        assert len(entries) < 2, f"More than one PackageEntry have the logical_key '{logical_key}'. That isn't right..."
        assert len(entries) > 0, f"No PackageEntry found with the logical_key '{logical_key}'"
        return entries[0]

    def __getitem__(self, logical_key):
        return self.get_entry(logical_key)


    def _find_readme_entry(self):
        readme_entries = []
        for entry in self._entries:
            if entry.logical_key.lower() == "readme":
                readme_entries.append((entry, None))

            split_on_period = entry.logical_key.split(".")
            if len(split_on_period) != 2:
                continue

            filename = split_on_period[0].lower()
            if filename == "readme":
                ext = split_on_period[1].lower()
                if ext in VALID_README_EXTENSIONS :
                    readme_entries.append((entry, ext))

        if len(readme_entries) == 0:
            return None

        # If there are multiple readme file types, prioritize according to order of VALID_README_EXTENSIONS
        for valid_ext in VALID_README_EXTENSIONS:
            for readme_entry, ext in readme_entries:
                if ext == valid_ext:
                    return readme_entry




    def readme(self):

        readme_entry = self._find_readme_entry()
        if readme_entry is None:
            ex_msg = f"This Package is missing a README file. A Quilt recognized README file is a (case-insensitive) " \
                     f"file named 'README' with any of the following file extensions: {VALID_README_EXTENSIONS}"
            raise QuiltException(ex_msg)

        return readme_entry.get_contents() # TODO(armand): Make sure we can handle all of the VALID_README_EXTENSIONS



    def ls(self, logical_key_prefix=""):
        """
        # TODO(armand): This probably deserves more thought, but maybe it's fine as is until users help us clarify
                        how this is used

        Given a logical_key prefix, list the contents. Treats '/' in logical keys as directory delimiter and is not
        recursive. The below example demonstrates what this means:

        If the Package contains the following logical keys:

        alpha/beta/1.txt
        alpha/beta/2.txt
        alpha/beta/3.txt
        alpha/4.txt

        > ls("alpha/")
        ["alpha/beta/", "alpha/4.txt"]

        > ls("alpha")
        ["alpha/beta/", "alpha/4.txt"]

        """
        dir_contents = set()
        for entry in self._entries:
            if not entry.logical_key.startswith(logical_key_prefix):
                continue

            lk_after_prefix = entry.logical_key.lstrip(logical_key_prefix)

            # Handle both "prefix" and "prefix/" as the same
            if lk_after_prefix.startswith("/"):
                lk_after_prefix = lk_after_prefix.lstrip("/")

            # Add objects in the dir
            if "/" not in lk_after_prefix:
                dir_contents.add(entry.logical_key)
                continue

            # Add a subdirectory marker
            subdir_marker = f"{lk_after_prefix.split('/')[0]}/"
            dir_contents.add(subdir_marker)

        return list(dir_contents)


    def dump_manifest(self): pass  # TODO(armand): Better name

    def __repr__(self): pass

    def __iter__(self): pass

    @staticmethod
    def extract_bucket_from_pkg_name(pkg_name):
        """ A Package is named: BUCKET/NAME """
        return pkg_name.split("/")[0]





class PackageEntry:
    SENTINEL = "NOT YET DOWNLOADED"
    def __init__(self, pkg_name, pkg_hash, logical_key, physical_key, size=None, entry_hash=None, metadata=None):
        # TODO: Do we need to URLEncode physical key? How do we handle an s3 key with a '?' in it that is returned by
        #       boto3.list_objects_v2() not urlencoded?
        self.pkg_name = pkg_name
        self.pkg_hash = pkg_hash
        self.logical_key = logical_key
        self.physical_key = physical_key
        self.size = size
        self._hash = entry_hash

        # SENTINEL indicates that there is metadata, but we haven't downloaded it
        self._metadata = metadata if metadata is not None else PackageEntry.SENTINEL


    @property
    def metadata(self):
        # If the metadata hasn't been downloaded, do that now.
        if self._metadata == PackageEntry.SENTINEL:
            self._metadata = Cache.get_metadata_for_entry(self.pkg_name, self.pkg_hash, self.logical_key)
        return self._metadata

    @property
    def entry_hash(self): return

    def get_bytes(self):
        return data_transfer.get_bytes(self.physical_key)

    def get_contents(self):
        """
        Try to return the contents in the form that the user wants.
        """
        pass




class PackageBuilder:
    def __init__(self, package=None): pass

    def _add_file(self, logical_key, physical_key, metadata, overwrite=False): pass

    def _add_dir(self, logical_key_prefix, physical_key_dir, shared_metadata, overwrite=False): pass

    def _add_package(self, pkg, overwrite=False): pass

    def _add_object(self, logical_key, python_object, serialization_options): pass

    def add(self, *args, **kwargs): pass



    def _set_file(self, logical_key, physical_key, metadata): pass

    def _set_dir(self, logical_key_prefix, physical_key_dir, shared_metadata): pass

    def set(self, *args, **kwargs):
        """
        TODO: Do we really need both `set` and `add`? They are conceptually different (what default behavior should
              be in the case of logical_key conflicts), but they might not deserve distinct APIs.
        """
        pass



    def remove_entry(self, logical_key): pass

    def remove_dir(self, logical_key_prefix): pass




    def rename_entry(self, current_logical_key, new_logical_key): pass

    def rename_dir(self, current_logical_key_prefix, new_logical_key_prefix): pass



    def build(self, package_name, tag=None, allow_local_files=False, allow_no_readme=False): pass

    def push_data(self, prefix): pass


    def __repr__(self): pass


class QuiltMissingReadmeException(Exception):
    pass

import torch

class ExamplePyTorchDataset(torch.utils.data.Dataset):

    def __init__(self, quilt_package_name, tag=None, pkg_hash=None):
        pkg = Package(quilt_package_name, tag=tag, pkg_hash=pkg_hash)

        self.img_entries = [entry for entry in pkg
                            if entry.logical_key.startswith("train/")]

        self.annotations = pkg["annotations/train.json"].get_contents()


    def __len__(self):
        return len(self.img_entries)


    def __getitem__(self, idx):
        entry = self.img_entries[idx]
        img_annotations = entry.metadata["annotations"]

        return {
            "image": entry.get_bytes(),  # Quilt takes care of the caching so you don't need to think about it.
            "annotations": img_annotations
        }

