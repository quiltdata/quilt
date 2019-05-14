"""test class against quilt.asa.plot"""
import os

import numpy as np
import pytest

from quilt.tools import command
from .utils import QuiltTestCase, try_require

if not try_require('quilt[img]'):
    # pylint: disable=unexpected-keyword-arg
    pytest.skip(
        "only test if [img] extras installed",
        allow_module_level=True)

# pylint: disable=no-self-use
class ImportTest(QuiltTestCase):
    # the following two lines must happen first
    import matplotlib as mpl
    mpl.use('Agg') # specify a backend so headless unit tests don't barf

    def test_asa_plot(self):
        from quilt.asa.img import plot

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, './build_img.yml')
        command.build('foo/imgtest', build_path)
        pkg = command.load('foo/imgtest')
        # expect no exceptions on root
        pkg(asa=plot())
        # pylint: disable=no-member
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
        # pylint: disable=invalid-name
        for x, y, _ in (ima_.shape, imb_.shape):
            assert x > 0 and y > 0, \
                'unexpected image dimension: {}'.format((x, y))
        # sum of normalized channel differences squared
        error_ = np.sum(((ima_ - imb_)/255) ** 2)
        # normalize by total number of samples
        error_ /= float(ima_.shape[0] * imb_.shape[1])

        return error_ < error
    
    def test_asa_plot_output(self):
        from PIL import Image
        from matplotlib import pyplot as plt

        from quilt.asa.img import plot

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, 'build_img.yml')
        command.build('foo/imgtest', build_path)
        pkg = command.load('foo/imgtest')

        outfile = os.path.join('.', 'temp-plot.png')
        # pylint: disable=no-member
        pkg.mixed.img(asa=plot(figsize=(10, 10)))
        # size * dpi = 1000 x 1000 pixels
        plt.savefig(outfile, dpi=100, format='png', transparent=False)

        ref_path = os.path.join(mydir, 'data', 'ref-asa-plot.png')

        ref_img = Image.open(ref_path)
        tst_img = Image.open(outfile)

        assert self._are_similar(ref_img, tst_img), \
            'render differs from reference: {}'.format(ref_img)

    def test_asa_plot_formats_output(self):
        from PIL import Image
        from matplotlib import pyplot as plt

        from quilt.asa.img import plot

        mydir = os.path.dirname(__file__)
        build_path = os.path.join(mydir, 'build_img.yml')
        command.build('foo/imgtest', build_path)
        pkg = command.load('foo/imgtest')

        outfile = os.path.join('.', 'temp-formats-plot.png')

        # pylint: disable=no-member
        pkg.mixed.img(asa=plot(figsize=(10, 10), formats=['png']))
        # size * dpi = 1000 x 1000 pixels
        plt.savefig(outfile, dpi=100, format='png', transparent=False)

        ref_path = os.path.join(mydir, 'data', 'ref-asa-formats.png')

        ref_img = Image.open(ref_path)
        tst_img = Image.open(outfile)

        assert self._are_similar(ref_img, tst_img), \
            'render differs from reference: {}'.format(ref_img)
