from . import data_transfer
from copy import deepcopy
import uuid
import warnings
from pathlib import Path

from .new_packages import PackageEntry
from .exceptions import PackageException
from .util import (
    QuiltException, make_s3_url, parse_file_url,
    parse_s3_url, quiltignore_filter, extract_file_extension,
    path_from_file_url, physical_key_is_s3, hash_file,
)
from .util import TEMPFILE_DIR_PATH as APP_DIR_TEMPFILE_DIR
from .formats import FormatRegistry
from .data_transfer import (
    calculate_sha256, copy_file, copy_file_list, get_bytes, get_size_and_meta,
    list_object_versions, put_bytes
)

class QuiltAddCollisionException(QuiltException):
    pass

class PackageBuilderEntry:
    """
    A PackageBuilderEntry (PBE) is an entry of PackageBuilder. The purpose of the class is to provide an interface that
    allows us to split up the work between cheap work that can happen at __init__() time and expensive work that should
    happen at build() time.

    Sometime there is no work to be done (e.g. you already have the size and hashes) and that is when
    PackageBuilderEntry class is used directly. More often you need to compute that information and then you will want
    to use a PBE subclass (LocalFilePBE, S3FilePBE, PythonObjectPBE).

    For all classes, build() will return an instance of PackageBuilderEntry.
    """

    def __init__(self, logical_key, physical_key, metadata, size, hash_type, hash_value):
        # TODO: AssertionErrors are customer unfriendly
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

    def set_physical_key(self, new_physical_key):
        """
        Be very careful with this! It is up to you to make sure that you are setting the physical_key to a key with
        the same size/hash_value.

        This function exists to protect against developers trying to set the physical_key of a PythonObjectPBE with
        code like `pbe.physical_key = new_physical_key` that would fail silently
        """
        self.physical_key = new_physical_key

    def build(self):
        return self  # Nothing need to be done

    def clone(self):
        return PackageBuilderEntry(self.logical_key, self.physical_key, deepcopy(self.metadata),
                                   self.size, self.hash_type, self.hash_value)

    def to_json(self):
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

    def build(self):
        pkey_path = path_from_file_url(self.physical_key)
        size = pkey_path.stat().st_size
        hash_type = "SHA256"
        with pkey_path.open() as f:
            hash_val = hash_file(f)

        return PackageBuilderEntry(self.logical_key, self.physical_key, self.metadata, size, hash_type, hash_val)

    def clone(self):
        return LocalFilePBE(self.logical_key, self.physical_key, deepcopy(self.metadata))

    def set_physical_key(self, new_physical_key):
        """
        Be very careful with this!

        It is up to you to make sure that you are setting the physical_key to a key that still has the correct
        size/hash_value.

        This function exists to protect against developers trying to set the physical_key of a PythonObjectPBE with
        code like `pbe.physical_key = new_physical_key` that would fail silently
        """
        self.physical_key = new_physical_key


class S3FilePBE(PackageBuilderEntry):
    def __init__(self, logical_key, physical_key, size=None, metadata=None):
        self.logical_key = logical_key
        self.physical_key = physical_key
        self._size = size
        self.metadata = metadata or {}

    @property
    def size(self):
        if self._size is None:
            self._size, _, _ = data_transfer.get_size_and_meta(self.physical_key)

        return self._size

    def build(self):

        hash_type = "SHA256"
        hash_val = data_transfer.calculate_sha256([self.physical_key], [self.size])

        # TODO: Do we want to get a version_id if it is missing and the bucket is versioned?
        return PackageBuilderEntry(self.logical_key, self.physical_key, self.metadata, self.size, hash_type, hash_val)

    def clone(self):
        return S3FilePBE(self.logical_key, self.physical_key, self.size, deepcopy(self.metadata))

    def set_physical_key(self, new_physical_key):
        """
        Be very careful with this!

        It is up to you to make sure that you are setting the physical_key to a key that still has the correct
        size/hash_value.

        This function exists to protect against developers trying to set the physical_key of a PythonObjectPBE with
        code like `pbe.physical_key = new_physical_key` that would fail silently
        """
        self.physical_key = new_physical_key


class PythonObjectPBE(PackageBuilderEntry):
    def __init__(self, logical_key, python_object, metadata=None, serialization_location=None, serialization_format_opts=None):
        self.logical_key = logical_key
        self.obj = python_object
        self.serialization_location = serialization_location
        self.serialization_format_opts = serialization_format_opts or {}
        self.metadata = metadata or {}

    @property
    def physical_key(self):
        raise TypeError("A PythonObjectPBE does not have a physical key because it is an in-memory object. Calling "
                        "build() will serialize the object and return a PackageBuilderEntry instance that has "
                        "a physical_key")

    @property
    def size(self):
        raise TypeError("A PythonObjectPBE does not have a size because it is an in-memory object. Calling "
                        "build() will serialize the object and return a PackageBuilderEntry instance that has a size")

    def build(self):
        # Use file extension from serialization_location, fall back to file extension from logical_key
        # If neither has a file extension, Quilt picks the serialization format based on type(python_object)
        logical_key_ext = extract_file_extension(self.logical_key)

        serialize_loc_ext = None
        if self.serialization_location is not None:
            serialize_loc_ext = extract_file_extension(self.serialization_location)

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

        format_handlers = FormatRegistry.search(type(self.obj))
        if ext:
            format_handlers = [f for f in format_handlers if ext in f.handled_extensions]

        if len(format_handlers) == 0:
            error_message = f'Quilt does not know how to serialize a {type(self.obj)}'
            if ext is not None:
                error_message += f' as a {ext} file.'
            error_message += f'. If you think this should be supported, please open an issue or PR at ' \
                             f'https://github.com/quiltdata/quilt'
            raise QuiltException(error_message)

        serialized_object_bytes, new_meta = format_handlers[0].serialize(self.obj, meta=None, ext=ext,
                                                                         **self.serialization_format_opts)
        if self.serialization_location is None:
            serialization_path = APP_DIR_TEMPFILE_DIR / str(uuid.uuid4())
            if ext:
                serialization_path = serialization_path.with_suffix(f'.{ext}')
        else:
            serialization_path = Path(self.serialization_location).expanduser().resolve()

        serialization_path.parent.mkdir(exist_ok=True, parents=True)
        serialization_path.write_bytes(serialized_object_bytes)

        size = serialization_path.stat().st_size
        physical_key = serialization_path.as_uri()

        hash_type = "SHA256"
        with serialization_path.open() as f:
            hash_val = hash_file(f)

        return PackageBuilderEntry(self.logical_key,
                                   physical_key,
                                   self.metadata,
                                   size,
                                   hash_type,
                                   hash_val)


    def clone(self):
        return PythonObjectPBE(self.logical_key,
                               deepcopy(self.obj),  # TODO(armand): Do all relevant objects support deepcopy? Are there memory implications that are worth worrying about?
                               deepcopy(self.metadata),
                               deepcopy(self.serialization_location),
                               deepcopy(self.serialization_format_opts))

    def set_physical_key(self, new_physical_key):
        """
        You cannot set the physical_key of a PythonObjectPBE because it hasn't been serialized to a file yet. Catching
        that mistake loudly is the reason this function exists
        """
        raise TypeError("You cannot set the physical_key of a PythonObjectPBE because it is an in-memory object. "
                        "Calling build() will serialize the object and return a PackageBuilderEntry instance with "
                        "a physical_key that can be set")






class PackageBuilder:
    def __init__(self, package=None, package_builder_entries=None):

        self.entries = package_builder_entries or []

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
            raise QuiltAddCollisionException("")  # TODO: Add useful error message

        if FormatRegistry.object_is_serializable(python_object):
            pbe = PythonObjectPBE(logical_key, python_object, metadata=metadata,
                                  serialization_location=None, serialization_format_opts=None)
            self[logical_key] = pbe
        else:
            raise TypeError(f"Unable to serialize {type(python_object)}. If you think we should be able to serialize "
                            f"this type, please open a ticket at github.com/quiltdata/quilt")

    def add_package_entry(self, logical_key, pkg_entry: PackageEntry, overwrite=False):
        # TODO: Should there be an option to change the metadata?

        if not overwrite and logical_key in self:
            raise QuiltAddCollisionException("")  # TODO: Add useful error message

        self[logical_key] = PackageBuilderEntry(logical_key,
                                                pkg_entry.physical_key,
                                                deepcopy(pkg_entry.metadata),
                                                pkg_entry.size,
                                                pkg_entry.hash_type,
                                                pkg_entry.hash_value)

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
        assert isinstance(package_builder_entry, PackageBuilderEntry)
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
                raise QuiltDeleteNonexistantEntryException("")  # TODO: Better exception message
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

    def rename_dir(self, current_logical_key_prefix, new_logical_key_prefix):
        current_logical_keys = [entry.logical_key
                                for entry in self.entries
                                if entry.logical_key.startswith(current_logical_key_prefix)]
        for current_logical_key in current_logical_keys:
            shared_suffix = current_logical_key.lstrip(current_logical_key_prefix)
            new_logical_key = new_logical_key_prefix + shared_suffix
            self.rename_entry(current_logical_key, new_logical_key)

    def build(self, package_name, tag=None, allow_local_files=False, allow_no_readme=False):  # TODO(implement)
        pass

    def push_data(self, bucket, s3_prefix, selector_fn=lambda package_builder_entry: True):
        # TODO: Do we want to support pushing data somewhere other than s3?
        """
        Users need to be able to choose what portion of their data they want to push:
        - Only unserialized python objects
        - Local files and Python objects
        - Any files not in the correct s3 bucket
        - Any files not in the correct s3 prefix

        We do this by having a selector_fn arg that is applied to each entry in self.entries. If the selector_fn
        returns True, we move the data. The data will be writen to: s3://{bucket}/{s3_prefix}/{entry.logical_key}

        If the data for an entry is moved, the PackageBuilderEntry will be changed to point to the new location.
        """
        if s3_prefix.endswith("/"):
            s3_prefix = s3_prefix.rstrip("/")

        unchanged_pbe_indices = set()
        changed_pbes = []
        files_to_copy_list = []
        for i in range(len(self.entries)):  # TODO: Parallelize this for loop - hashing is serial right now
            pbe = self.entries[i]
            if not selector_fn(pbe):
                unchanged_pbe_indices.add(i)
                continue

            new_physical_key_without_version_id = f"s3://{bucket}/{s3_prefix}/{pbe.logical_key}"

            # Make sure that, if a local file is going to s3 and we don't yet have the hash, we hash before moving it
            if isinstance(pbe, (PythonObjectPBE, LocalFilePBE)):
                pbe = pbe.build()
                # self.entries[i] = pbe  # Potential optimization, but need more thought about possible failure cases

            files_to_copy_list.append([pbe.physical_key, new_physical_key_without_version_id, pbe.size])
            changed_pbes.append(pbe)

        new_physical_keys_with_version_id = copy_file_list(files_to_copy_list) # TODO(very important): Make sure the order is guaranteed since we are relying on it


        assert len(changed_pbes) == len(new_physical_keys_with_version_id), \
            "These must always match. If this error appears, something is very wrong - please " \
            "open a ticket at https://github.com/quiltdata/quilt"

        # Update the PBEs to point to the new physical_keys with version_id
        for i in range(len(changed_pbes)):
            changed_pbes[i].set_physical_key(new_physical_keys_with_version_id[i])

        # Now we rebuild the entries list, maintaining order
        new_entries_list = []
        for i in range(len(self.entries)):
            if i in unchanged_pbe_indices:
                new_entries_list.append(self.entries[i])
            else:
                new_entries_list.append(changed_pbes.pop(0))

        self.entries = new_entries_list


    def __repr__(self):  # TODO(implement)
        pass
