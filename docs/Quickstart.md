<!-- markdownlint-disable -->
# Quick Start Guide

Get up and running with Quilt in minutes! This guide provides multiple learning paths based on your experience level and preferred learning style.

## 🚀 Choose Your Learning Path

### 👨‍💻 **For Developers** - Hands-on Python Tutorial
Start coding immediately with our interactive Python tutorial:
* **[Interactive Python Tutorial](https://open.quiltdata.com/b/quilt-example/packages/examples/quickstart/tree/latest/QuickStart.ipynb)** - Learn `quilt3` through practical examples

### 📺 **For Visual Learners** - Video Tutorials
Watch comprehensive video guides:
* **[Complete Video Series](https://www.youtube.com/playlist?list=PLmXfD6KoA_vBtgGgt0X4ui4cRlEkdJKp9)** - How to work with S3 datasets using Quilt
* **Duration**: ~30 minutes total
* **Topics**: Installation, basic operations, data versioning, collaboration

### 📊 **For Data Scientists** - Real Dataset Exploration
Explore production datasets with guided examples:
* **[CORD-19 Dataset Analysis](https://open.quiltdata.com/b/quilt-example/packages/akarve/cord19)** - Real-world COVID research data exploration
* **[Machine Learning with PyTorch](https://medium.com/pytorch/how-to-iterate-faster-in-machine-learning-by-versioning-data-and-models-featuring-detectron2-4fd2f9338df5)** - Versioning data and models for rapid ML experimentation

## ⚡ 5-Minute Quick Start

### 1. **Install Quilt**
<!-- pytest.mark.skip -->
```bash
pip install quilt3
```

### 2. **Authenticate (Optional for Public Data)**

For public datasets like `s3://quilt-example`, no authentication is needed. For private buckets or catalogs, choose your authentication method:

```python
import quilt3

# Interactive login (for local development, notebooks)
quilt3.login()  # Opens browser for OAuth/SSO

# OR use an API key (for automation, CI/CD, scripts)
import os
quilt3.login_with_api_key(os.environ["QUILT_API_KEY"])
```

**📚 Learn more**: See the [Authentication Guide](walkthrough/authentication.md) for detailed setup instructions, best practices, and use cases.

### 3. **Browse Public Data**
```python
import quilt3

# Browse available datasets (no auth needed for public data)
packages = list(quilt3.list_packages("s3://quilt-example"))
print(f"Found {len(packages)} public datasets")

# Load a sample dataset
pkg = quilt3.Package.browse("examples/hurdat", "s3://quilt-example")
print(pkg)
```

### 4. **Access Your First File**
<!-- pytest-codeblocks:cont -->
```python
# Download and read a file (using pkg from previous step)
data_file = pkg["README_NF_QUILT.md"]
content = data_file.get()
print(content)
```

### 5. **Create Your First Package**
```python
import quilt3
import tempfile
import os

# Create a temporary file
with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
    f.write("Hello, Quilt!")
    temp_file = f.name

# Create a new package
new_pkg = quilt3.Package()
new_pkg.set("my_data.txt", temp_file)
new_pkg.set_meta({"description": "My first Quilt package"})

# Clean up
os.unlink(temp_file)

# Note: Pushing requires S3 credentials, so we'll just show the package
print(f"Package created with {len(new_pkg)} files")
```

## 🎯 Next Steps

### **Beginner Path**
1. ✅ Complete the 5-minute quick start above
2. 📖 Read the [Mental Model](MentalModel.md) to understand Quilt concepts
3. 🔧 Follow the [Installation Guide](Installation.md) for your environment
4. 📝 Try the [Basic Workflows](walkthrough/uploading-a-package.md)

### **Intermediate Path**
1. 🏗️ Set up your [AWS Integration](aws-integration.md)
2. 👥 Configure [Team Collaboration](Catalog/Collaboration.md)
3. 🔍 Learn [Advanced Search](walkthrough/working-with-elasticsearch.md)
4. 📊 Explore [Data Visualization](Catalog/VisualizationDashboards.md)

### **Advanced Path**
1. 🔐 Configure [Cross-Account Access](CrossAccount.md)
2. ⚡ Set up [EventBridge Integration](EventBridge.md)
3. 🤖 Implement [Automated Workflows](advanced-features/workflows.md)
4. 🔧 Use the [Admin API](api-reference/Admin.md)

## 🌐 Explore Open Data

Discover publicly available datasets:
* **[Open Quilt Data Portal](https://open.quiltdata.com/)** - Browse hundreds of public datasets
* **Featured Collections**: COVID-19 research, climate data, genomics, financial datasets
* **No registration required** - Start exploring immediately

## 💡 Common Use Cases

### **Data Science Teams**
- Version control for datasets and models
- Reproducible research and experiments
- Collaborative data exploration

### **ML/AI Development**
- Dataset versioning for model training
- Experiment tracking and comparison
- Model artifact management

### **Enterprise Data Management**
- Centralized data catalog
- Data governance and compliance
- Cross-team data sharing

### **Research Organizations**
- Research data management
- Publication-ready data packages
- Long-term data preservation

## 🆘 Need Help?

- 📖 **Documentation**: Browse the full [Quilt Documentation](/)
- 💬 **Community**: Join our [Slack Community](https://quiltusers.slack.com/)
- 🐛 **Issues**: Report bugs on [GitHub](https://github.com/quiltdata/quilt/issues)
- 📧 **Support**: Contact [support@quiltdata.com](mailto:support@quiltdata.com)

---

**Ready to dive deeper?** Continue with the [Mental Model](MentalModel.md) to understand how Quilt organizes and manages your data.
