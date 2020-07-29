# Developer notes
* How we get pdftoppm running with MS fonts
* On MacBook testing: jpeg faster than png, pdftoppm faster than pdftocairo

## Extracting pdftoppm, pdftocairo (via poppler-utils) as standalones
```
yum install yum-utils rpmdevtools
yumdownloader poppler-utils 

# Extract files from .rpm
rpmdev-extract *.rpm
```

Then you need to run the binaries by hand and discover which .o files are missing. These files
were found to be children of /usr/lib64 and when they are copied to the same, /usr/bin/pdftoppm works.

Consider setting [`LD_LIBRARY_PATH`](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime)
to include /somedir/usr/lib64 so Linux can find the libs.


## Getting MS fonts

* [Installing cabextract on Amazon Linux](https://aws.amazon.com/premiumsupport/knowledge-center/ec2-enable-epel/)
* [Adding MS fonts to linux](http://mscorefonts2.sourceforge.net/)

Above step will add fonts to `cp -r /usr/share/fonts`

## Making the fonts discoverable via pdftoppm, etc.

* [fonts.conf](https://stackoverflow.com/questions/46486261/include-custom-fonts-in-aws-lambda)
* `fc-cache` (unix util)

```
export FONTCONFIG_PATH=/io/fonts/
```

## `pdftoppm`
* Page numbering starts at 1 (not 0)
* Providing size=INT to a convert function ensures largest dimension == INT
* first_page can be negative (lib rounds up to 1)
* last_page can be > than total pages (lib takes min)

No format (=ppm) faster than JPEG faster than PNG

``` (=ppm)(=ppm) 
In [8]: %timeit imgs = pdf2image.convert_from_path("tests/data/MUMmer.pdf", fmt="png",size=(1024,768))                                                             
4.3 s ± 162 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)

In [9]: %timeit imgs = pdf2image.convert_from_path("tests/data/MUMmer.pdf", fmt="jpeg", size=(1024,768))                                                            
970 ms ± 58.2 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)

In [10]: %timeit imgs = pdf2image.convert_from_path("tests/data/MUMmer.pdf", size=(1024,768))                                                                      
798 ms ± 37.2 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

jpeg also outputs faster:
```
In [14]: %timeit imgs[3].save("tmp-1024-768.png")                                     
198 ms ± 4.97 ms per loop (mean ± std. dev. of 7 runs, 10 loops each)

In [15]: %timeit imgs[3].save("tmp-1024-768.jpeg")                                    
44.1 ms ± 4.36 ms per loop (mean ± std. dev. of 7 runs, 10 loops each)
```