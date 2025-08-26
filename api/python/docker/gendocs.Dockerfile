FROM ubuntu:latest

# Install Python 3.9 (matches CI test-gendocs job exactly)
RUN apt-get update && apt-get install -y \
    python3.9 \
    python3.9-pip \
    python3.9-dev \
    python3.9-venv \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks to match CI environment
RUN ln -sf /usr/bin/python3.9 /usr/bin/python3
RUN ln -sf /usr/bin/python3.9 /usr/bin/python

# Install exact dependencies as CI test-gendocs job
RUN python -m pip install --upgrade pip setuptools
RUN python -m pip install nbconvert git+https://github.com/quiltdata/pydoc-markdown.git@v2.0.5+quilt3.2

WORKDIR /workspace

# Set environment to match CI
ENV QUILT_DISABLE_USAGE_METRICS=true
ENV PYTHONPATH=/workspace

# Default command
CMD ["bash"]