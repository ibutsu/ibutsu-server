.. _user-guide/getting-started:

Getting Started
===============

Requirements
------------

To get started using Ibutsu, you'll need to :ref:`set up a server <user-guide/running-server>`,
and then start sending results to it.


Using the pytest plugin
-----------------------

Sending results on-the-fly
##########################

Ibutsu has a companion pytest plugin which can be used to send results to Ibutsu from pytest.

You can install the pytest plugin via pip:

.. code-block:: shell

   pip install pytest-ibutsu


Once installed, you can activate the Ibutsu pytest plugin by specifying your Ibutsu server on the
command line:

.. code-block:: shell

   pytest --ibutsu http://ibutsu-server/api


If you're running Ibutsu locally for development, and you want to upload results to your local
instance, you can do that too:

.. code-block:: shell

   pytest --ibutsu http://127.0.0.1:8080/api


You can also specify the project, source and extra metadata via command line arguments:

.. code-block:: shell

   pytest --ibutsu http://ibutsu-server/api --ibutsu-project my-project
   pytest --ibutsu http://ibutsu-server/api --ibutsu-data key=value --ibutsu-data key2=value2
   pytest --ibutsu http://ibutsu-server/api --ibutsu-source my-test-run-2

Importing results from the archive
##################################

Ibutsu's pytest plugin will create a `.tar.gz` archive that can be used to upload results
in the event that connection to the Ibutsu server is not possible.

Via the Ibutsu UI
*****************
Simply click on the "Import" button in the top right of the Ibutsu UI and select the
appropriate archive.

Via the Ibutsu API
******************
Archives may be imported via the ``import`` API endpoint. For example, one may use the
following curl command:

.. code-block:: shell

  curl --form importFile=@<file-name>.tar.gz http://ibutsu-server/api/import


Importing results from Junit XML
--------------------------------

Via the Ibutsu UI
#################
If you have legacy pytest test results stored in Junit XML files, those can be imported
via the Ibutsu UI. Simply click on the "Import" button in the top right, and select your XML file.

A run will be created for each ``testsuite`` in the XML file. For each ``testcase`` of the
``testsuite``, a result will be created.

Note: for new test results, it is strongly recommended to use the pytest plugin. The XML import
does not upload screenshots and log files.

Via the Ibutsu API
##################
Junit XML files generated from pytest can be imported at the ``import`` API endpoint. For example,
one may use the following curl command:

.. code-block:: shell

  curl --form importFile=@<file-name>.xml http://ibusu-server/api/import

Installing the API client
-------------------------

There is also a Python API client that can be used to push results into Ibutsu.

You can install the API client via pip:

.. code-block:: shell

   pip install ibutsu-client
