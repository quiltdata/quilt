.PHONY: build publish clean

build: quilt3_local/catalog_bundle
	poetry build

publish: quilt3_local/catalog_bundle
	poetry publish --build

catalog-repo: catalog-commit
	rm -rf catalog-repo
	mkdir catalog-repo
	cd catalog-repo && \
		git init && \
		git remote add origin git@github.com:quiltdata/quilt.git && \
		git fetch --depth 1 origin `cat ../catalog-commit` && \
		git checkout FETCH_HEAD

catalog-repo/catalog/build: catalog-repo
	cd catalog-repo/catalog && npm ci && npm run build

quilt3_local/catalog_bundle: catalog-repo/catalog/build
	rm -rf quilt3_local/catalog_bundle
	cp -r catalog-repo/catalog/build quilt3_local/catalog_bundle

clean:
	rm -rf catalog-repo
	rm -rf dist
