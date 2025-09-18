# Configuration file for the Sphinx documentation builder.
#
# This file only contains a selection of the most common options. For a full
# list see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html
# -- Path setup --------------------------------------------------------------
# If extensions (or modules to document with autodoc) are in another directory,
# add these directories to sys.path here. If the directory is relative to the
# documentation root, use os.path.abspath to make it absolute, like shown here.
#
# import os
# import sys
# sys.path.insert(0, os.path.abspath('.'))
# -- Project information -----------------------------------------------------

project = "Ibutsu"
copyright = "2025, Red Hat Quality Engineering"
author = "Red Hat Quality Engineering"

# The full version, including alpha/beta/rc tags
release = "2.7.4"


# -- General configuration ---------------------------------------------------

# Add any Sphinx extension module names here, as strings. They can be
# extensions coming with Sphinx (named 'sphinx.ext.*') or your custom
# ones.
extensions = ["sphinx_copybutton"]

# Add any paths that contain templates here, relative to this directory.
templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = []

# In older versions of Sphinx, this was "contents"
master_doc = "index"

# -- Options for HTML output -------------------------------------------------

# The theme to use for HTML and HTML Help pages.  See the documentation for
# a list of builtin themes.
#
html_theme = "furo"

# Add any paths that contain custom static files (such as style sheets) here,
# relative to this directory. They are copied after the builtin static files,
# so a file named "default.css" will overwrite the builtin "default.css".
html_static_path = ["_static"]


# custom configuration
html_css_files = ["css/ibutsu.css"]
html_favicon = "_static/images/favicon.ico"
html_logo = "_static/images/ibutsu-logo.png"
html_title = "Ibutsu"
html_theme_options = {
    "light_css_variables": {
        "color-brand-primary": "#3f9c35",
        "color-brand-content": "#3f9c35",
        "font-stack": "'Red Hat Text', 'Lato', 'proxima-nova', 'Helvetica Neue', Arial, sans-serif",
        "font-stack-monospace": "'Hack', monospace",
    },
    "dark_css_variables": {
        "color-brand-primary": "#3f9c35",
        "color-brand-content": "#3f9c35",
    },
}
pygments_style = "gruvbox-light"
pygments_dark_style = "gruvbox-dark"
