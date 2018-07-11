"""test class against quilt.asa.torch"""
import os

import pytest
from six import string_types

from quilt.tools import command
from quilt.nodes import DataNode
from .utils import QuiltTestCase, try_require

if not try_require('quilt[img,pytorch,torchvision]'):
    # pylint: disable=unexpected-keyword-arg
    pytest.skip("only test if [img,pytorch,torchvision] extras installed",
        allow_module_level=True)

# pylint: disable=no-self-use
class ImportTest(QuiltTestCase):
    def test_asa_pytorch(self):
        """test asa.torch interface by converting a GroupNode with asa="""
        from torchvision.transforms import Compose, CenterCrop, ToTensor, Resize
        from torch.utils.data import Dataset
        from PIL import Image
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
        # pylint: disable=protected-access
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
        # pylint: disable=no-member
        my_dataset = pkg.mixed.img(asa=dataset(
            include=is_image,
            node_parser=node_parser,
            input_transform=input_transform(crop_size, upscale_factor),
            target_transform=target_transform(crop_size)
        ))
        assert isinstance(my_dataset, Dataset), \
            'expected type {}, got {}'.format(type(Dataset), type(my_dataset))

        assert my_dataset.__len__() == 2, \
            'expected two images in mixed.img, got {}'.format(my_dataset.__len__())

        for i in range(my_dataset.__len__()):
            tens = my_dataset.__getitem__(i)
            assert all((isinstance(x, Tensor) for x in tens)), \
                'Expected all torch.Tensors in tuple, got {}'.format(tens)
