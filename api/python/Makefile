PYTHON=python3
PIP=$(PYTHON) -m pip

test:
	$(PYTHON) -m pytest --disable-warnings

install-local:
	$(PIP) install -e '.[tests]'

