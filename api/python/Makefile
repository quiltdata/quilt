
test:
	pytest --disable-warnings

install-local:
	pip install -e .[tests]

testdocs:
	cd ../../testdocs && poetry install && poetry run pytest --codeblocks ../docs