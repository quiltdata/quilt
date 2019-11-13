from abc import abstractmethod
from .util import QuiltException
from . import data_transfer
from .exceptions import PackageException
from pathlib import Path
from .data_transfer import (
    calculate_sha256, copy_file, copy_file_list, get_bytes, get_size_and_meta,
    list_object_versions, put_bytes
)
from .exceptions import PackageException
from .formats import FormatRegistry
from .util import (
    QuiltException, fix_url, get_from_config, get_install_location, make_s3_url, parse_file_url,
    parse_s3_url, validate_package_name, quiltignore_filter, validate_key, extract_file_extension, file_is_local
)
import warnings
from copy import deepcopy
from .util import TEMPFILE_DIR_PATH as APP_DIR_TEMPFILE_DIR

import uuid

LATEST_TAG = "latest"
VALID_README_EXTENSIONS = ["md", "txt", "rtf", "rst", "ipynb", None]

def get_s3_object(bucket, key):
    return bytes()

def physical_key_is_s3(physical_key):
    return physical_key.startswith("s3://")



class QuiltRegistry:
    def __init__(self): pass

    @staticmethod
    def packages():  # TODO(implement)
        # View all installed Packages along with disk usage for each
        pass

    @staticmethod
    def status(pkg):  # TODO(implement)
        # Is pkg installed? If yes, what is and isn't cached?
        pass



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
    def s3_key_for_full_manifest(pkg_name, pkg_hash):  # TODO(implement)
        pass

    @staticmethod
    def s3_key_for_fast_manifest(pkg_name, pkg_hash):  # TODO(implement)
        pass

    @staticmethod
    def s3_key_for_metadata_chunk(pkg_name, pkg_hash, logical_key):  # TODO(implement)
        pass

    @staticmethod
    def s3_key_for_tag(pkg_name, tag):  # TODO(implement)
        pass


class Cache:
    @staticmethod
    def get_full_manifest(pkg_name, pkg_hash):  # TODO(implement)
        # Return (package_metadata_JSON, list_of_entry_JSONs)
        return {}, []

    @staticmethod
    def get_fast_manifest(pkg_name, pkg_hash):  # TODO(implement)
        # Return (package_metadata_JSON, list_of_entry_JSONs)
        return {}, []


    @staticmethod
    def get_metadata_for_entry(pkg_name, pkg_hash, logical_key):  # TODO(implement)
        # Return metadata as JSON
        pass




class Package:

    def __init__(self, pkg_name, pkg_hash=None, tag=None):
        """
        Download enough of the manifest so that a user can start working with it. Other pieces can be JIT downloaded,
        but the core list of PackageEntries should be populated.

        TODO(PERF): This method needs to be performance tested to ensure that exploring a dataset does not feel slow
        """

        # If only a pkg_name if given, default to latest tag
        if pkg_hash is None and tag is None:
            tag = LATEST_TAG

        # If the user passed in a tag, find the matching hash.
        if tag is not None:
            try:
                hash_for_tag = Manifest.get_hash_from_tag(pkg_name, tag)
            except Exception as ex:
                raise ex  # TODO: Improve UX. Most common exception is probably lack of S3 permissions

            # If the user also passed in pkg_hash, make sure they match
            if pkg_hash is not None:
                # TODO: Assertion errors are not customer friendly
                assert hash_for_tag == pkg_hash, f"You specified both a tag and a pkg_hash. Currently, tag " \
                                                 f"'{tag}' points to hash {hash_for_tag}, which does not match " \
                                                 f"the hash you specified ({pkg_hash}). You can pass in just the tag."
            pkg_hash = hash_for_tag

        # We now have pkg_name and pkg_hash which are enough for us to download the Fast Manifest

        # Download fast manifest, set Package metadata, create PackageEntries
        pkg_metadata, manifest_entry_jsons = Cache.get_fast_manifest(self.name, pkg_hash)
        entries = []
        for manifest_entry_json in manifest_entry_jsons:
            entries.append(PackageEntry(
                pkg_name=self.name,
                pkg_hash=pkg_hash,
                logical_key=manifest_entry_json["logical_key"],
                physical_key=manifest_entry_json["physical_key"],
                size=manifest_entry_json["size"],
                entry_hash=manifest_entry_json["hash"]["value"],
                metadata=manifest_entry_json["meta"]
            ))
        self.__shared_init__(pkg_name, tag, pkg_hash, pkg_metadata, entries)

    def __shared_init__(self, pkg_name, pkg_tag, pkg_hash, pkg_metadata, pkg_entries):
        # Logic that should be run by both `Package.__init__` and `MockPackageWithoutInitLogic.__init__`
        self.name = pkg_name
        self.bucket = Package.extract_bucket_from_pkg_name(self.name)
        self.tag = pkg_tag
        self._hash = pkg_hash
        self._metadata = pkg_metadata
        self.entries = pkg_entries
        return self

    @property
    def pkg_hash(self):
        return self._hash

    @property
    def metadata(self):
        return self._metadata

    def download_data(self, loc=None):  # TODO(implement)
        pass

    def verify(self, loc=None):  # TODO(implement)
        # Confirm that the downloaded data matches the manifest
        pass

    def push(self, tag=None):  # TODO(implement)
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
            raise QuiltNoReadmeException(ex_msg)

        return readme_entry.get_contents() # TODO(armand): Make sure we can handle all of the VALID_README_EXTENSIONS

    def ls(self, logical_key_prefix=""):
        """
        # TODO(armand): This probably deserves more thought, but maybe it's fine as is until users help us clarify
                        how this is used

        Given a logical_key prefix, list the contents. Treats '/' in logical keys as directory delimiter and is not
        recursive. The below example demonstrates what this means:

        Package
          ├ alpha/beta/1.txt
          ├ alpha/beta/2.txt
          ├ alpha/beta/3.txt
          └ alpha/4.txt

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

    def dump_manifest(self):  # TODO(implement)
        pass

    def load_from_manifest(self, file_obj_or_json_list):  # TODO(implement)
        pass

    def __repr__(self):  # TODO(implement)
        pass

    def __iter__(self):  # TODO(implement)
        pass

    def __eq__(self, other):
        if type(self) != type(other):
            return False

        if len(self.entries) != len(other.entries):
            return False

        if self.name != other.name:
            return False

        if self.tag != other.tag:
            return False

        if self.pkg_hash != other.pkg_hash:
            return False

        if self.metadata != other.metadata:
            # TODO: Potential bug comparing dictionaries without considering order of entries
            return False

        self_sorted_entries = sorted(self.entries, key=lambda entry: entry.logical_key)
        other_sorted_entries = sorted(other.entries, key=lambda entry: entry.logical_key)
        for i in range(len(self.entries)):
            if self_sorted_entries[i] != other_sorted_entries[i]:
                return False

        return True


    @staticmethod
    def extract_bucket_from_pkg_name(pkg_name):
        """ A Package is named: BUCKET/NAME """
        return pkg_name.split("/")[0]


class MockPackageWithoutInitLogic(Package):
    def __init__(self, pkg_name, pkg_tag, pkg_hash, pkg_metadata, pkg_entries):
        self.__shared_init__(pkg_name, pkg_tag, pkg_hash, pkg_metadata, pkg_entries)




class PackageEntry:
    SENTINEL = "NOT YET DOWNLOADED"
    def __init__(self, pkg_name, pkg_hash, logical_key, physical_key, size, entry_hash, metadata=None):
        # TODO: Do we need to URLEncode physical key? How do we handle an s3 key with a '?' in it that is returned by
        #       boto3.list_objects_v2() not urlencoded?
        # TODO: Can size and entry_hash ever be None? I don't think so as PE is always fully built
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
    def entry_hash(self):
        return self._hash

    def get_bytes(self):
        return data_transfer.get_bytes(self.physical_key)

    def get_contents(self):  # TODO(implement)
        # Try to return the contents in the form that the user wants.
        pass

    def __eq__(self, other):
        if type(self) != type(other):
            return False

        if self.pkg_name != other.pkg_name:
            return False

        if self.pkg_hash != other.pkg_hash:
            return False

        if self.logical_key != other.logical_key:
            return False

        if self.physical_key != other.physical_key:
            return False

        if self.size != other.size:
            return False

        if self.entry_hash != other.entry_hash:
            return False

        if self.metadata != other.metadata:
            # TODO: Potential bug comparing dictionaries without considering order of entries
            return False

        return True

    def clone(self):
        return self.__class__(deepcopy(self.pkg_name),
                              deepcopy(self.pkg_hash),
                              deepcopy(self.logical_key),
                              deepcopy(self.physical_key),
                              deepcopy(self.size),
                              deepcopy(self.entry_hash),
                              metadata=deepcopy(self.metadata))



class PackageBuilderEntry:
    """ Subclasses should have __init__ be instantaneous and defer any work to build() """
    def __init__(self, logical_key, physical_key, metadata, size, hash_type, hash_value):
        assert logical_key is not None
        assert physical_key is not None
        assert metadata is not None
        assert size is not None
        assert hash_type is not None
        assert hash_value is not None

        self.logical_key = logical_key
        self.physical_key = physical_key
        self.metadata = metadata
        self.size = size
        self.hash_type = hash_type
        self.hash_value = hash_value

    @abstractmethod
    def build(self):
        pass

    @abstractmethod
    def clone(self):
        pass

    def to_json(self):
        # TODO: AssertionErrors are customer unfriendly

        return {
            "logical_key": self.logical_key,
            "physical_key": self.physical_key,
            "size": self.size,
            "hash": {
                "type": self.hash_type,
                "value": self.hash_value
            },
            "metadata": self.metadata
        }


class LocalFilePBE(PackageBuilderEntry):
    def __init__(self, logical_key, physical_key, metadata=None):
        self.logical_key = logical_key
        self.physical_key = physical_key
        self.metadata = metadata or {}

    def build(self):  # TODO(implement)
        # Get size
        # Get hash type and value
        # Return PBE instance
        pass

    def clone(self):  # TODO(implement)
        pass


class S3FilePBE(PackageBuilderEntry):
    def __init__(self, logical_key, physical_key, size=None, metadata=None):
        """
        We may or may not have size at

        """
        self.logical_key = logical_key
        self.physical_key = physical_key
        self.size = size
        self.metadata = metadata or {}

    def build(self):  # TODO(implement)
        # Get size
        # Get hash type and value
        # Do we want to get a version_id if it is missing and the bucket is versioned?
        # Return PBE instance
        pass

    def clone(self):  # TODO(implement)
        pass


class PythonObjectPBE(PackageBuilderEntry):
    def __init__(self, logical_key, python_object, metadata=None, serialization_location=None, serialization_format_opts=None):
        self.logical_key = logical_key
        self.obj = python_object
        self.metadata = metadata or {}

    def build(self):  # TODO(implement)
        # Serialize
        # Get size
        # Get hash type and value
        # Return PBE instance
        """
        # Use file extension from serialization_location, fall back to file extension from logical_key
            # If neither has a file extension, Quilt picks the serialization format.
            logical_key_ext = extract_file_extension(logical_key)

            serialize_loc_ext = None
            if serialization_location is not None:
                serialize_loc_ext = extract_file_extension(serialization_location)

            if logical_key_ext is not None and serialize_loc_ext is not None:
                assert logical_key_ext == serialize_loc_ext, f"The logical_key and the serialization_location have " \
                                                             f"different file extensions: {logical_key_ext} vs " \
                                                             f"{serialize_loc_ext}. Quilt doesn't know which to use!"

            if serialize_loc_ext is not None:
                ext = serialize_loc_ext
            elif logical_key_ext is not None:
                ext = logical_key_ext
            else:
                ext = None

            format_handlers = FormatRegistry.search(type(python_object))
            if ext:
                format_handlers = [f for f in format_handlers if ext in f.handled_extensions]

            if len(format_handlers) == 0:
                error_message = f'Quilt does not know how to serialize a {type(python_object)}'
                if ext is not None:
                    error_message += f' as a {ext} file.'
                error_message += f'. If you think this should be supported, please open an issue or PR at ' \
                                 f'https://github.com/quiltdata/quilt'
                raise QuiltException(error_message)

            if serialization_format_opts is None:
                serialization_format_opts = {}
            serialized_object_bytes, new_meta = format_handlers[0].serialize(python_object, meta=None, ext=ext,
                                                                             **serialization_format_opts)
            if serialization_location is None:
                serialization_path = APP_DIR_TEMPFILE_DIR / str(uuid.uuid4())
                if ext:
                    serialization_path = serialization_path.with_suffix(f'.{ext}')
            else:
                serialization_path = Path(serialization_location).expanduser().resolve()

            serialization_path.parent.mkdir(exist_ok=True, parents=True)
            serialization_path.write_bytes(serialized_object_bytes)

            size = serialization_path.stat().st_size
            write_url = serialization_path.as_uri()
            entry = PackageEntry([write_url], size, hash_obj=None, meta=new_meta)
        """
        pass

    def clone(self):  # TODO(implement)
        pass

class PackageEntryPBE(PackageBuilderEntry):
    def __init__(self, logical_key, package_entry):  # TODO(implement)
        # PackageEntries have logical keys. Should we let user set a new logical key? New metadata?
        # Make sure to clone package_entry
        pass

    def build(self):  # TODO(implement)
        # Return PBE instance
        pass

    def clone(self):  # TODO(implement)
        pass



class PackageBuilder:
    def __init__(self, package=None):
        self.entries = []

        if package is not None:
            self.add_package(package)

    def __contains__(self, logical_key):
        matches = [e for e in self.entries if e.logical_key == logical_key]
        assert len(matches) < 2, "There should never be more that one entry with a given logical_key"
        return len(matches) == 1

    def __setitem__(self, logical_key, package_builder_entry):
        if logical_key not in self:
            self.entries.append(package_builder_entry)
            return

        for i in range(len(self.entries)):
            if self.entries[i].logical_key == logical_key:
                self.entries[i] = package_builder_entry
                return

    def __delitem__(self, logical_key):
        del_idx = None
        for i, entry in enumerate(self.entries):
            if logical_key == entry.logical_key:
                del_idx = i
                break

        if del_idx is not None:
            del self.entries[del_idx]
        else:
            pass
            # TODO(armand): Should this raise an exception?



    def add_file(self, logical_key, physical_key=None, metadata=None, overwrite=False):

        if physical_key is None:
            physical_key = logical_key

        if not overwrite and logical_key in self:
            raise QuiltAddCollisionException("") # TODO: Add useful error message


        if physical_key_is_s3(physical_key):
            # TODO: Check physical key exists
            self[logical_key] = S3FilePBE(logical_key, physical_key, metadata=metadata)
        else:
            # TODO: Check physical key exists
            self[logical_key] = LocalFilePBE(logical_key, physical_key, metadata=metadata)




    def add_object(self, logical_key, python_object, metadata=None, overwrite=False):
        if not overwrite and logical_key in self:
            raise QuiltAddCollisionException("") # TODO: Add useful error message

        if FormatRegistry.object_is_serializable(python_object):
            pbe = PythonObjectPBE(logical_key, python_object, metadata=metadata, serialization_location=None, serialization_format_opts=None)
            self[logical_key] = pbe
        else:
            raise TypeError(f"Unable to serialize {type(python_object)}. If you think we should be able to serialize "
                            f"this type, please open a ticket at github.com/quiltdata/quilt")



    def add_package_entry(self, logical_key, pkg_entry, overwrite=False):
        # TODO: Should there be an option to change the metadata?

        if not overwrite and logical_key in self:
            raise QuiltAddCollisionException("")  # TODO: Add useful error message

        self[logical_key] = PackageEntryPBE(logical_key, pkg_entry.clone())


    def _add_dir_s3(self, logical_key_prefix, s3_dir, shared_metadata, overwrite):
        # TODO(armand): Should we be checking .quiltignore for s3?
        assert logical_key_prefix is not None and s3_dir is not None, "Both logical_key_prefix and s3_dir must be given"
        bucket, physical_key_prefix, version = parse_s3_url(s3_dir)

        if version:
            raise PackageException("Directories cannot have versions")

        if not physical_key_prefix.endswith('/'):
            physical_key_prefix += '/'

        if not logical_key_prefix.endswith('/'):
            logical_key_prefix += '/'

        objects, _ = list_object_versions(bucket, physical_key_prefix)  # TODO(armand): confirm works as expected

        for obj in objects:
            obj_s3_key = obj['Key']

            if not obj['IsLatest']:
                continue

            # Skip S3 pseudo directory files and Keys that end in /  # TODO(armand): Is this behavior we really need?
            if obj_s3_key.endswith('/'):
                if obj['Size'] != 0:  # TODO(armand): I don't understand this check
                    warnings.warn(f'Logical keys cannot end in "/", skipping: {obj_s3_key}')


            physical_key = make_s3_url(bucket, obj_s3_key, obj.get('VersionId'))

            logical_key = logical_key_prefix + obj_s3_key.lstrip(physical_key_prefix)
            if not overwrite and logical_key in self:
                raise QuiltAddCollisionException("")  # TODO: Add useful error message

            self[logical_key] = S3FilePBE(logical_key, physical_key, size=obj['Size'], metadata=shared_metadata)


    def _add_dir_local(self, logical_key_prefix, local_dir, shared_metadata, overwrite):
        assert logical_key_prefix is not None and local_dir is not None, "Both logical_key_prefix and " \
                                                                                "local_dir must be set"


        dir_path = Path(parse_file_url(local_dir))
        if not dir_path.is_dir():
            raise PackageException("The specified directory doesn't exist")  # TODO: Better exception

        files = dir_path.rglob('*')
        ignore = dir_path / '.quiltignore'  # TODO: Revisit the .quiltigore logic. Shouldn't the quiltignore to use be based on the cwd?
        if ignore.exists():
            files = quiltignore_filter(files, ignore, 'file')

        for f in files:
            if not f.is_file():
                continue
            logical_key = f.relative_to(dir_path).as_posix()
            if not overwrite and logical_key in self:
                raise QuiltAddCollisionException("")  # TODO: Add useful error message
            physical_key = f.as_uri()
            self[logical_key] = LocalFilePBE(logical_key, physical_key, metadata=shared_metadata)


    def add_dir(self, logical_key_prefix, physical_key_dir=None, shared_metadata=None, overwrite=False):
        if physical_key_dir is None:
            physical_key_dir = logical_key_prefix

        if physical_key_is_s3(physical_key_dir):
            self._add_dir_s3(logical_key_prefix, physical_key_dir, shared_metadata, overwrite)
        else:
            self._add_dir_local(logical_key_prefix, physical_key_dir, shared_metadata, overwrite)


    def add_package(self, pkg, overwrite=False):
        assert isinstance(pkg, Package)  # TODO: More thoughtful error message
        for pkg_entry in pkg:
            self.add_package_entry(pkg_entry.logical_key, pkg_entry, overwrite=overwrite)





    def add(self, *args, **kwargs):
        """ Mapping from args/kwargs to which add_XXX function to call is not clear right now. """
        raise NotImplementedError("This convenience function will be implemented after we have implemented all of "
                                  "the add_XXX functions")


    def _set_package_builder_entry(self, logical_key, package_builder_entry):
        assert isinstance(package_builder_entry, PackageBuilderEntry)  # TODO: Does this work correctly for subclasses?
        self[logical_key] = package_builder_entry

    def _set_file(self, logical_key, physical_key, metadata):
        self.add_file(logical_key, physical_key, metadata=metadata, overwrite=True)


    def _set_dir(self, logical_key_prefix, physical_key_dir, shared_metadata):
        self.add_dir(logical_key_prefix, physical_key_dir, shared_metadata=shared_metadata, overwrite=True)


    def _set_package_entry(self, logical_key, package_entry):
        self.add_package_entry(logical_key, package_entry, overwrite=True)

    def set(self, *args, **kwargs):  # TODO(implement)
        """
        TODO: Do we really need both `set` and `add`? They are conceptually different (what default behavior should
              be in the case of logical_key conflicts), but they might not deserve distinct APIs.
        """
        pass



    def remove_entry(self, logical_key, nonexistant_ok=False):
        if logical_key not in self:
            if not nonexistant_ok:
                raise QuiltDeleteNonexistantEntryException("")  # TODO: Better exceptionn message
            return

        del self[logical_key]



    def remove_dir(self, logical_key_prefix):
        lkeys_to_del = []
        for pbe in self.entries:
            if pbe.logical_key.startswith(logical_key_prefix):
                lkeys_to_del.append(pbe.logical_key)

        for lkey_to_del in lkeys_to_del:
            self.remove_entry(lkey_to_del)




    def rename_entry(self, current_logical_key, new_logical_key):
        if current_logical_key not in self:
            raise QuiltRenameNonexistantEntryException("")  # TODO: more detailed error message
        else:
            new_pbe = self[current_logical_key].clone()
            new_pbe.logical_key = new_logical_key
            self[new_logical_key] = new_pbe
            del self[current_logical_key]


    def rename_dir(self, current_logical_key_prefix, new_logical_key_prefix):  # TODO(implement)
        current_logical_keys = [entry.logical_key
                                for entry in self.entries
                                if entry.logical_key.startswith(current_logical_key_prefix)]
        for current_logical_key in current_logical_keys:
            shared_suffix = current_logical_key.lstrip(current_logical_key_prefix)
            new_logical_key = new_logical_key_prefix + shared_suffix
            self.rename_entry(current_logical_key, new_logical_key)





    def build(self, package_name, tag=None, allow_local_files=False, allow_no_readme=False):  # TODO(implement)
        pass

    def push_data(self, prefix):  # TODO(implement)
        pass


    def __repr__(self):  # TODO(implement)
        pass



class QuiltRenameNonexistantEntryException(QuiltException):
    pass

class QuiltDeleteNonexistantEntryException(QuiltException):
    pass

class QuiltAddCollisionException(QuiltException):
    pass

class QuiltNoReadmeException(QuiltException):
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

