.. _user-guide/running-server:

Running the Server
==================

Running Locally
---------------

Generally you'll only want to run the server locally when you're developing Ibutsu. To see how to
set this up, take a look at the :ref:`developer-guide/getting-started` section in the Developer
Guide.


Running in Containers
---------------------

The easiest way to run Ibutsu is via containers with either `Docker <https://docker.io>`_ or
`Podman <https://podman.io>`_. Ibutsu images are available on `Quay.io <https://quay.io/organization/ibutsu>`_.

Using `Docker Compose <https://docs.docker.com/compose/>`_ or `Podman Compose <https://github.com/containers/podman-compose>`_
can make deploying containers much easier, and we have included a :ref:`examples/compose` example.


Deploying to OKD
----------------

If you want to deploy Ibutsu to `OKD <https://www.okd.io/>`_ or `OpenShift <https://www.openshift.com/>`_,
we have also included an :ref:`examples/okd-template` example.

To create a project in OKD from this template, run the following command:

.. code-block:: shell

   oc create -f ibutsu-okd-template.yaml
