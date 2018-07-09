"""
Tests for magic imports.
"""
import os
from platform import system
import time

# the following two lines must happen first
import matplotlib as mpl
mpl.use('Agg') # specify a backend so renderer doesn't barf
# pylint: disable=wrong-import-position
from PIL import Image
import numpy as np
import pandas as pd
from matplotlib import pyplot as plt
from six import string_types

from quilt.tools import command
from quilt.nodes import DataNode, GroupNode
from quilt.tools.const import PACKAGE_DIR_NAME
from quilt.tools.package import Package
from quilt.tools.store import PackageStore, StoreException
from quilt.asa.img import plot
from .utils import patch, QuiltTestCase

 # pylint: disable=protected-access
class ImportTest(QuiltTestCase):
    def test_imports(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package', build_path)

        # Good imports

        from quilt.data.foo import package
        from quilt.data.foo.package import dataframes
        from quilt.data.foo.package import README

        # Contents of the imports

        assert isinstance(package, GroupNode)
        assert isinstance(dataframes, GroupNode)
        assert isinstance(dataframes.csv, DataNode)
        assert isinstance(README, DataNode)

        assert package.dataframes == dataframes
        assert package.README == README

        assert package['dataframes'] == dataframes
        assert package['README'] == README

        assert set(dataframes._keys()) == {'csv', 'nulls'}
        assert set(dataframes._group_keys()) == set()
        assert set(dataframes._data_keys()) == {'csv', 'nulls'}

        assert len(package) == 2
        assert len(list(package)) == 2

        assert 'dataframes' in dir(package)

        for item in package:
            assert isinstance(item, (GroupNode, DataNode))

        for node in dataframes:
            assert isinstance(node, DataNode)

        assert isinstance(README(), string_types)
        assert isinstance(README._data(), string_types)
        assert isinstance(dataframes.csv(), pd.DataFrame)
        assert isinstance(dataframes.csv._data(), pd.DataFrame)

        str(package)
        str(dataframes)
        str(README)

        # Store data is read-only
        with self.assertRaises(IOError):
            with open(README(), 'w'):
                pass

        # Bad attributes of imported packages

        with self.assertRaises(AttributeError):
            package.foo

        with self.assertRaises(AttributeError):
            package.dataframes.foo

        with self.assertRaises(AttributeError):
            package.dataframes.csv.foo

        # Bad imports

        with self.assertRaises(ImportError):
            import quilt.data.foo.bad_package

        with self.assertRaises(ImportError):
            import quilt.data.bad_user.bad_package

        with self.assertRaises(ImportError):
            from quilt.data.foo.dataframes import blah

        with self.assertRaises(ImportError):
            from quilt.data.foo.baz import blah

    def test_team_imports(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('test:bar/package', build_path)

        # Good imports

        from quilt.team.test.bar import package
        from quilt.team.test.bar.package import dataframes
        from quilt.team.test.bar.package import README

        # Contents of the imports

        assert isinstance(package, GroupNode)
        assert isinstance(dataframes, GroupNode)
        assert isinstance(dataframes.csv, DataNode)
        assert isinstance(README, DataNode)

        assert package.dataframes == dataframes
        assert package.README == README

        assert set(dataframes._keys()) == {'csv', 'nulls'}
        assert set(dataframes._group_keys()) == set()
        assert set(dataframes._data_keys()) == {'csv', 'nulls'}

        assert isinstance(README(), string_types)
        assert isinstance(README._data(), string_types)
        assert isinstance(dataframes.csv(), pd.DataFrame)
        assert isinstance(dataframes.csv._data(), pd.DataFrame)

        str(package)
        str(dataframes)
        str(README)

        # Bad attributes of imported packages

        with self.assertRaises(AttributeError):
            package.foo

        with self.assertRaises(AttributeError):
            package.dataframes.foo

        with self.assertRaises(AttributeError):
            package.dataframes.csv.foo

        # Bad imports

        with self.assertRaises(ImportError):
            import quilt.team.test.bar.bad_package

        with self.assertRaises(ImportError):
            import quilt.team.test.bad_user.bad_package

        with self.assertRaises(ImportError):
            from quilt.team.test.bar.dataframes import blah

        with self.assertRaises(ImportError):
            from quilt.team.test.bar.baz import blah

    def test_import_group_as_data(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_group_data.yml')
        command.build('foo/grppkg', build_path)

        # Good imports
        from quilt.data.foo import grppkg
        assert isinstance(grppkg.dataframes, GroupNode)

        # Make sure child dataframes were concatenated in the correct order (alphabetically by node name).
        df = grppkg.dataframes._data()
        assert df['x'].tolist() == [1, 2, 3, 4]
        assert df['y'].tolist() == [1, 4, 9, 16]

        # Incompatible Schema
        with self.assertRaises(StoreException):
            grppkg.incompatible._data()

        # Empty group
        grppkg.dataframes._add_group("empty")
        assert grppkg.dataframes.empty._data() is None

        # In-memory dataframe
        grppkg._set(['dataframes', 'foo'], pd.DataFrame([1, 2, 3]))
        with self.assertRaises(NotImplementedError):
            grppkg.dataframes._data()

    def test_multiple_package_dirs(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')  # Contains 'dataframes'
        simple_build_path = os.path.join(mydir, './build_simple.yml')  # Empty

        new_build_dir = 'aaa/bbb/%s' % PACKAGE_DIR_NAME

        # Build two packages:
        # - First one exists in the default dir and the new dir; default should take priority.
        # - Second one only exists in the new dir.

        # First package.
        command.build('foo/multiple1', build_path)

        # First and second package in the new build dir.
        with patch.dict(os.environ, {'QUILT_PRIMARY_PACKAGE_DIR': new_build_dir}):
            command.build('foo/multiple1', simple_build_path)
            command.build('foo/multiple2', simple_build_path)

        # Cannot see the second package yet.
        with self.assertRaises(ImportError):
            from quilt.data.foo import multiple2

        # Now search the new build dir.
        dirs = 'foo/%s:%s' % (PACKAGE_DIR_NAME, new_build_dir)
        with patch.dict(os.environ, {'QUILT_PACKAGE_DIRS': dirs}):
            # Can import the second package now.
            from quilt.data.foo import multiple2

            # The first package contains data from the default dir.
            from quilt.data.foo import multiple1
            assert multiple1.dataframes

    def test_save(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package1', build_path)

        from quilt.data.foo import package1

        # Build an identical package
        command.build('foo/package2', package1)

        from quilt.data.foo import package2
        teststore = PackageStore(self._store_dir)
        contents1 = open(os.path.join(teststore.package_path(None, 'foo', 'package1'),
                                      Package.CONTENTS_DIR,
                                      package1._package.get_hash())).read()
        contents2 = open(os.path.join(teststore.package_path(None, 'foo', 'package2'),
                                      Package.CONTENTS_DIR,
                                      package2._package.get_hash())).read()
        assert contents1 == contents2

        # Rename an attribute
        package1.dataframes2 = package1.dataframes
        del package1.dataframes

        # Modify an existing dataframe
        csv = package1.dataframes2.csv._data()
        csv.at[0, 'Int0'] = 42

        # Add a new dataframe
        df = pd.DataFrame(dict(a=[1, 2, 3]))
        package1._set(['new', 'df'], df)
        assert package1.new.df._data() is df

        # Add a new file
        file_path = os.path.join(mydir, 'data/foo.csv')
        package1._set(['new', 'file'], 'data/foo.csv', build_dir=mydir)
        assert package1.new.file._data() == file_path

        # Add a new group
        package1._add_group('newgroup')
        assert isinstance(package1.newgroup, GroupNode)
        package1.newgroup._add_group('foo')
        assert isinstance(package1.newgroup.foo, GroupNode)

        # Overwrite a leaf node
        new_path = os.path.join(mydir, 'data/nuts.csv')
        package1._set(['newgroup', 'foo'], 'data/nuts.csv', build_dir=mydir)
        assert package1.newgroup.foo._data() == new_path

        # Overwrite the whole group
        package1._set(['newgroup'], 'data/nuts.csv', build_dir=mydir)
        assert package1.newgroup._data() == new_path

        # Set some custom metadata
        package1._meta['foo'] = 'bar'
        package1.newgroup._meta['x'] = 'y'

        # Built a new package and verify the new contents
        command.build('foo/package3', package1)

        from quilt.data.foo import package3

        assert hasattr(package3, 'dataframes2')
        assert not hasattr(package3, 'dataframes')

        new_csv = package3.dataframes2.csv._data()
        assert new_csv.xs(0)['Int0'] == 42

        new_df = package3.new.df._data()
        assert new_df.xs(2)['a'] == 3

        new_file = package3.new.file._data()
        assert isinstance(new_file, string_types)

        assert package3._meta['foo'] == 'bar'
        assert package3.newgroup._meta['x'] == 'y'

        # Try setting invalid metadata
        package1.new.df._meta['_system'] = 1
        with self.assertRaises(command.CommandException):
            command.build('foo/package4', package1)

        package3._meta['foo'] = {'bar': lambda x: x}
        with self.assertRaises(command.CommandException):
            command.build('foo/package5', package3)

    def test_filtering(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package', build_path)

        pkg = command.load('foo/package')

        pkg.dataframes._meta['foo'] = 'bar'

        # "False" filter
        empty = pkg._filter(lambda node, name: False)
        assert not empty._keys()

        # "True" filter
        pkg_copy = pkg._filter(lambda node, name: True)
        assert set(pkg_copy._keys()) == set(pkg._keys())
        assert set(pkg_copy.dataframes._keys()) == set(pkg.dataframes._keys())
        # Group nodes are copied.
        assert pkg_copy is not pkg
        assert pkg_copy.dataframes is not pkg.dataframes
        # Group metadata is a copy of the original.
        assert pkg_copy.dataframes._meta is not pkg.dataframes._meta
        assert pkg_copy.dataframes._meta == pkg.dataframes._meta
        # Leaf nodes are the originals.
        assert pkg_copy.README is pkg.README
        assert pkg_copy.dataframes.csv is pkg.dataframes.csv

        # "True" using dict syntax.
        pkg_copy = pkg._filter({})
        assert set(pkg_copy._keys()) == set(pkg._keys())

        # Non-existant metadata.
        pkg_copy = pkg._filter({'meta': {'non_existant': 'blah'}})
        assert not pkg_copy._keys()

        # Single node.
        pkg_copy = pkg._filter({'name': 'csv'})
        assert set(pkg_copy._keys()) == {'dataframes'}
        assert set(pkg_copy.dataframes._keys()) == {'csv'}

        # Returning "True" for a group copies its children.
        pkg_copy = pkg._filter({'meta': {'foo': 'bar'}})
        assert set(pkg_copy._keys()) == {'dataframes'}
        assert set(pkg_copy.dataframes._keys()) == set(pkg.dataframes._keys())
        # Same thing for the root node.
        pkg_copy = pkg._filter({'name': ''})
        assert set(pkg_copy._keys()) == set(pkg._keys())

        # System metadata.
        pkg_copy = pkg._filter({'meta': {'_system': {'transform': 'csv'}}})
        assert set(pkg_copy._keys()) == {'dataframes'}
        assert set(pkg_copy.dataframes._keys()) == set(pkg.dataframes._keys())

        # Invalid filter.
        with self.assertRaises(ValueError):
            pkg._filter([])
        with self.assertRaises(ValueError):
            pkg._filter({'whatever': 'blah'})

    def test_set_non_node_attr(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package4', build_path)

        from quilt.data.foo import package4

        # Assign a DataFrame as a node
        # (should throw exception)
        df = pd.DataFrame(dict(a=[1, 2, 3]))
        with self.assertRaises(TypeError):
            package4.newdf = df

    def test_load_update(self):
        # also tests dynamic import
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package5', build_path)
        from ..data.foo import package5

        # make a copy, to prove we can
        newpkgname = 'foo/copied_package'
        command.build(newpkgname, package5)

        newfilename = 'myfile'+str(int(time.time()))
        with open(newfilename, 'w') as fh:
            fh.write('hello world1')

        module = command.load(newpkgname)
        module._set([newfilename], newfilename)
        command.build(newpkgname, module)

        # current spec requires that build() *not* update the in-memory module tree.
        newpath1 = module[newfilename]()
        assert newpath1 == newfilename

        # current spec requires that load() reload from disk, i.e. gets a reference
        # to the local object store
        # this is important because of potential changes to myfile
        reloaded_module = command.load(newpkgname)
        assert reloaded_module is not module
        newpath2 = reloaded_module[newfilename]()
        assert 'myfile' not in newpath2

    def test_multiple_updates(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package6', build_path)
        from ..data.foo import package6

        newfilename1 = 'myfile1'+str(int(time.time()))
        with open(newfilename1, 'w') as fh:
            fh.write('hello world1')

        package6._set([newfilename1], newfilename1)

        newfilename2 = 'myfile2'+str(int(time.time()))
        with open(newfilename2, 'w') as fh:
            fh.write('hello world2')

        package6._set([newfilename1], newfilename2)

        assert package6[newfilename1]() == newfilename2

    def test_team_non_team_imports(self):
        mydir = os.path.dirname(__file__)
        build_path1 = os.path.join(mydir, './build_simple.yml')
        command.build('myteam:foo/team_imports', build_path1)
        build_path2 = os.path.join(mydir, './build_empty.yml')
        command.build('foo/team_imports', build_path2)

        # Verify that both imports work, and packages are in fact different.

        from ..team.myteam.foo import team_imports as pkg1
        from ..data.foo import team_imports as pkg2

        assert hasattr(pkg1, 'foo')
        assert not hasattr(pkg2, 'foo')

    def test_team_set_non_node_attr(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('test:bar/package4', build_path)

        from quilt.team.test.bar import package4

        # Assign a DataFrame as a node
        # (should throw exception)
        df = pd.DataFrame(dict(a=[1, 2, 3]))
        with self.assertRaises(TypeError):
            package4.newdf = df

    def test_datanode_asa(self):
        testdata = "justatest"
        def test_lambda(node, hashes):
            assert isinstance(node, DataNode)
            assert hashes
            for path in hashes:
                assert os.path.exists(path)
            return testdata

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package', build_path)
        pkg = command.load('foo/package')
        assert pkg.dataframes.csv(asa=test_lambda) is testdata

    def test_groupnode_asa(self):
        testdata = "justatest"
        def test_lambda(node, hashes):
            assert isinstance(node, GroupNode)
            assert hashes
            for path in hashes:
                assert os.path.exists(path)
            return testdata

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package', build_path)

        pkg = command.load('foo/package')
        assert pkg.dataframes(asa=test_lambda) is testdata
        assert pkg(asa=test_lambda) is testdata

    # pylint: disable=no-member
    def test_asa_plot(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_img.yml')
        command.build('foo/imgtest', build_path)
        pkg = command.load('foo/imgtest')
        # expect no exceptions on root
        pkg(asa=plot())
        # expect no exceptions on GroupNode with only DF children
        pkg.dataframes(asa=plot())
        # expect no exceptions on GroupNode with mixed children
        pkg.mixed(asa=plot())
        # expect no exceptions on dir of images
        pkg.mixed.img(asa=plot())
        pkg.mixed.img(asa=plot(formats=['jpg', 'png']))
        # assert images != filtered, 'Expected only .jpg and .png images'
        # expect no exceptions on single images
        pkg.mixed.img.sf(asa=plot())
        pkg.mixed.img.portal(asa=plot())

    def _are_similar(self, ima, imb, error=0.01):
        """predicate to see if images differ by less than
        the given error; uses mean squared error; see also
        https://www.pyimagesearch.com/2014/09/15/python-compare-two-images/

        ima, imb: PIL.Image instances
        """
        ima_ = np.array(ima).astype('float')
        imb_ = np.array(imb).astype('float')
        assert ima_.shape == imb_.shape, 'ima and imb must have same shape'
        for x, y, _ in (ima_.shape, imb_.shape):
            assert x > 0 and y > 0, 'unexpected image dimension: {}'.format(shape)
        # sum of normalized channel differences squared
        error_ = np.sum(((ima_ - imb_)/255) ** 2)
        # normalize by total number of samples
        error_ /= float(ima_.shape[0] * imb_.shape[1])

        return error_ < error
    
    # pylint: disable=no-member
    def test_asa_plot_output(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, 'build_img.yml')
        command.build('foo/imgtest', build_path)
        pkg = command.load('foo/imgtest')

        outfile = os.path.join('.', 'temp-plot.png')
        pkg.mixed.img(asa=plot(figsize=(10, 10)))
        # size * dpi = 1000 x 1000 pixels
        plt.savefig(outfile, dpi=100, format='png', transparent=False)

        ref_path = os.path.join(mydir, 'data', 'ref-asa-plot.png')

        ref_img = Image.open(ref_path)
        tst_img = Image.open(outfile)

        assert self._are_similar(ref_img, tst_img), \
            'render differs from reference: {}'.format(ref_img)

    # pylint: disable=no-member
    def test_asa_plot_formats_output(self):
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, 'build_img.yml')
        command.build('foo/imgtest', build_path)
        pkg = command.load('foo/imgtest')

        outfile = os.path.join('.', 'temp-formats-plot.png')
        pkg.mixed.img(asa=plot(figsize=(10, 10), formats=['png']))
        # size * dpi = 1000 x 1000 pixels
        plt.savefig(outfile, dpi=100, format='png', transparent=False)

        ref_path = os.path.join(mydir, 'data', 'ref-asa-formats.png')

        ref_img = Image.open(ref_path)
        tst_img = Image.open(outfile)

        assert self._are_similar(ref_img, tst_img), \
            'render differs from reference: {}'.format(ref_img)


    @pytest.mark.xfail(system() in ['Windows'], reason=(
      "infeasible to install pytorch on appveyor (even with conda)"
    ))
    def test_asa_pytorch(self):
        """test asa.torch interface by converting a GroupNode with asa="""
        from torchvision.transforms import Compose, CenterCrop, ToTensor, Resize
        from torch.utils.data import Dataset
        from torch import Tensor

        from quilt.asa.pytorch import dataset
        # pylint: disable=missing-docstring
        # helper functions to simulate real pytorch dataset usage
        def calculate_valid_crop_size(crop_size, upscale_factor):
            return crop_size - (crop_size % upscale_factor)

        def node_parser(node):
            path = node()
            if isinstance(path, string_types):
                img = Image.open(path).convert('YCbCr')
                chan, _, _ = img.split()
                return chan
            else:
                raise TypeError('Expected string path to an image fragment')

        def input_transform(crop_size, upscale_factor):
            return Compose([
                CenterCrop(crop_size),
                Resize(crop_size // upscale_factor),
                ToTensor(),
            ])

        def target_transform(crop_size):
            def _inner(img):
                img_ = img.copy()
                return Compose([
                    CenterCrop(crop_size),
                    ToTensor(),
                ])(img_)
            return _inner

        def is_image(node):
            """file extension introspection on Quilt nodes"""
            if isinstance(node, DataNode):
                filepath = node._meta.get('_system', {}).get('filepath')
                if filepath:
                    return any(
                        filepath.endswith(extension)
                        for extension in [".png", ".jpg", ".jpeg"])
        # end helper functions

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, 'build_img.yml')
        command.build('foo/torchtest', build_path)
        pkg = command.load('foo/torchtest')

        upscale_factor = 3
        crop_size = calculate_valid_crop_size(256, upscale_factor)
        my_dataset = pkg.mixed.img(asa=dataset(
            include=is_image,
            node_parser=node_parser,
            input_transform=input_transform(crop_size, upscale_factor),
            target_transform=target_transform(crop_size)
        ))
        assert isinstance(my_dataset, Dataset), \
            'expected type {}, got {}'.format(type(Dataset), type(my_dataset))

        assert my_dataset.__len__() == 2, \
            'expected two images in mixed.img, got {}'.format()

        for i in range(my_dataset.__len__()):
            tens = my_dataset.__getitem__(i);
            assert all((isinstance(x, Tensor) for x in tens)), \
                'Expected all torch.Tensors in tuple, got {}'.format(tens)

    def test_memory_only_datanode_asa(self):
        testdata = "justatest"
        def test_lambda(node, hashes):
            return testdata

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package', build_path)
        pkg = command.load('foo/package')
        pkg._set(['dataframes', 'memory'], pd.DataFrame())
        with self.assertRaises(ValueError):
            assert pkg.dataframes.memory(asa=test_lambda) is testdata
        
    def test_load_by_hash(self):
        """
        Tests loading two different versions of the same
        package using command.load and specifying the package
        hash.
        """
        # Old Version
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build.yml')
        command.build('foo/package', build_path)
        package = command.load('foo/package')
        pkghash = package._package.get_hash()

        # New Version
        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_simple.yml')
        command.build('foo/package', build_path)
        command.ls()

        load_pkg_new = command.load('foo/package')
        load_pkg_old = command.load('foo/package', hash=pkghash)    
        assert load_pkg_old._package.get_hash() == pkghash

        assert load_pkg_new.foo
        with self.assertRaises(AttributeError):
            load_pkg_new.dataframes
        # Known failure cases
        # At present load does not support extended package syntax
        with self.assertRaises(command.CommandException):
            command.load('foo/package:h:%s' % pkghash)
        with self.assertRaises(command.CommandException):
            command.load('foo/package:t:latest')
        with self.assertRaises(command.CommandException):
            command.load('foo/package:v:1.0.0')
