# Use official Python 3.11 image (matches CI Python version)
FROM python:3.11-slim

# Install git and other tools needed for CI
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install exact CI versions to match py-ci.yml
RUN python -m pip install --upgrade pip setuptools
RUN python -m pip install 'pylint==3.2.7' 'pycodestyle>=2.6.1' isort

WORKDIR /workspace

# Set environment to match CI
ENV QUILT_DISABLE_USAGE_METRICS=true
ENV PYTHONPATH=/workspace

# Default command
CMD ["bash"]