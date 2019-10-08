from quilt3 import data_checker
from PIL import Image

LABEL_SET = ['🦓', '🐎']

class quiltDataCheckPackageOfImages(data_checker.TestCase):
    @data_checker.TestCase.test_package
    def validateImageSize(self):
        "Validate that every object has size > 1 MB and is labeled horse or zebra"
        for logical_key in self.quilt_package:
            self.assertTrue(logical_key.size() > 1_000_000)
            self.assertTrue(logical_key.meta_data['label'] in LABEL_SET)

class quiltDataCheckValidImages(data_checker.TestCase):
    @data_checker.TestCase.test_key('images/*.jpeg') # Logical key
    def validateImageParsable(self, image):
        img = Image.open(image)
        self.assertTrue(img.format == 'jpeg')
        self.assertTrue(img.mode == 'rgba')