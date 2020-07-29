# Developer notes
* How we get pdftoppm running with MS fonts
* On MacBook testing: png faster than jpeg, pdftoppm faster than pdftocairo

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

