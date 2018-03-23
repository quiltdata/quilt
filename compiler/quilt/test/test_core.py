"""
Test core.py
"""
import os

import quilt
from ..tools.core import GroupNode, RootNode, FileNode
from .utils import QuiltTestCase

class CoreTest(QuiltTestCase):
    def test_compiler_registry_identical(self):
        """
        Verify that the compiler and the registry have the same core.py.
        Not the best way to accomplish this, but oh well...
        """
        quilt_dir = os.path.dirname(quilt.__file__)
        compiler_core = os.path.join(quilt_dir, 'tools', 'core.py')
        registry_core = os.path.join(quilt_dir, '..', '..', 'registry', 'quilt_server', 'core.py')
        with open(compiler_core) as fd1, open(registry_core) as fd2:
            assert fd1.read() == fd2.read()

    def test_preorder(self):
        """
        Test that preorder returns nodes in the expected order.
        """

        a1 = FileNode([], dict())
        a2 = FileNode([], dict())
        a = GroupNode(dict(a1=a1, a2=a2))

        b1 = FileNode([], dict())
        b2 = FileNode([], dict())
        b = GroupNode(dict(a1=b1, a2=b2))

        root = RootNode(dict(a=a, b=b))

        assert list(root.preorder()) == [root, a, a1, a2, b, b1, b2]
