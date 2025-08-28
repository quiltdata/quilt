# Use official Python 3.9 image (matches CI gendocs job)
FROM python:3.9-slim

# Install git and other tools needed for CI
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install exact dependencies as CI test-gendocs job
RUN python -m pip install --upgrade pip setuptools
RUN python -m pip install nbconvert git+https://github.com/quiltdata/pydoc-markdown.git@v2.0.5+quilt3.2

WORKDIR /workspace

# Set environment to match CI
ENV QUILT_DISABLE_USAGE_METRICS=true
ENV PYTHONPATH=/workspace

# Default command
CMD ["bash"]