from quilt3 import data_checker
from PIL import Image

LABEL_SET = ['🦓', '🐎']

class CheckPackageOfImages(data_checker.TestCase):
    @data_checker.TestCase.test_package()
    def quilt_data_check_ImageSize(self):
        "Validate that every object has size > 1 MB and is labeled horse or zebra"
        for entry in self.quilt_package:
            self.assertTrue(entry.size() > 1_000_000)
            self.assertTrue(entry.meta_data['label'] in LABEL_SET)
        return

class CheckValidImages(data_checker.TestCase):
    @data_checker.TestCase.test_key('images/foo.jpeg') # Logical key
    def quilt_data_check_ImageParsable(self, logical_key):
        img = Image.open(logical_key)
        self.assertTrue(img.format == 'jpeg')
        self.assertTrue(img.mode == 'rgba')