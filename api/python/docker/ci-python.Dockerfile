FROM ubuntu:latest

# Install Python 3.11 (matches CI exactly)
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-pip \
    python3.11-dev \
    python3.11-venv \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks to match CI environment
RUN ln -sf /usr/bin/python3.11 /usr/bin/python3
RUN ln -sf /usr/bin/python3.11 /usr/bin/python

# Install exact CI versions to match py-ci.yml
RUN python -m pip install --upgrade pip setuptools
RUN python -m pip install 'pylint==3.2.7' 'pycodestyle>=2.6.1' isort

WORKDIR /workspace

# Set environment to match CI
ENV QUILT_DISABLE_USAGE_METRICS=true
ENV PYTHONPATH=/workspace

# Default command
CMD ["bash"]