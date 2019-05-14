build: notebook pygments-css
	npx -p less lessc ipynb.less | npx -p clean-css-cli cleancss -o ../static/ipynb.css

notebook:
	git clone https://github.com/jupyter/notebook.git
	cd notebook && npx bower install

pygments-css:
	git clone https://github.com/richleland/pygments-css.git

clean:
	rm -rf notebook pygments-css

.PHONY: build clean
