# OCP Template Guide

OpenShift templates are provided for each microservice that makes up ibutsu-server. Though many of the
parameters are the same from template-to-template, they are kept separate for maintainability and
readability.

There are three sets of templates for the microservices: ``stage`` and ``prod`` and ``mpp``.

The supported template set is ``mpp``, it has been updated to support Deployment objects (compared to the deprecated DeploymentConfigs used in the other sets).

## Stage
The stage templates are set up to use the images at [quay.io/organization/ibutsu](https://quay.io/organization/ibutsu) that are tagged with
``master``. These images are built and tagged as ``master`` on every merge into [github.com/ibutsu/ibutsu-server](https://github.com/ibutsu/ibutsu-server).
These are meant to deploy the "staging" or "unstable" instance of Ibutsu.

## Prod
The prod templates are set up to use the images at [quay.io/organization/ibutsu](https://quay.io/organization/ibutsu) that are tagged with
``latest``. These images are built and tagged as ``latest`` on every release of Ibutsu. These are meant to deploy the production instance of Ibutsu. The templates include some extra things like database
backups and vacuums.

## Mpp
The MPP templates are meant to be used on an v4 Openshift cluster

Note: the ``jobs`` directory contains cronjobs and jobs to vacuum and backup the database. Both of these
are included in the `prod/postgres.yaml` template.

## Using the templates

Regardless of environment, the templates are used in the same way. The order in which they should be
deployed is:
- postgres
- redis
- backend
- worker
- scheduler
- frontend
- flower (optional)

The method for creating the objects from the templates is the same as any OpenShift template. Consult
[the official docs on templates](https://docs.openshift.com/container-platform/4.9/openshift_images/using-templates.html) for
more information.

### Process templates and create objects via 'oc'
For each of the templates, you'll want process the template with the proper parameters and create the object in OpenShift.
Some examples are shown below:

#### postgres
```console
oc process -f ./stage/postgres.yaml -p NAMESPACE=iqe-stage-ibutsu-server | oc create -f -
```

#### redis
```console
oc process -f ./stage/redis.yaml -p NAMESPACE=iqe-stage-ibutsu-server | oc create -f -
```

#### backend
```console
 oc process -f ./stage/backend.yaml -p NAMESPACE=iqe-stage-ibutsu-server -p BACKEND_ROUTE=stage-ibutsu-api.example.com -p FRONTEND_ROUTE=stage-ibutsu.example.com -p REDIS_PASSWORD=<redis-password> | oc create -f -
```

Proceed similarly for the other templates. Remember to specify the same values if the same parameters are used in multiple templates.

Note that this is the recommended way to deploy, as it makes any errors that show up more visible.

### Add template and create objects via the OpenShift UI
First add the template(s) to your OpenShift project:

```console
oc create -f <filename>.yaml
```
Then navigate to your project in the OCP console in the "Developer" view and click "Add to project".
Search for your template and fill out the form to fill in all the parameters of the template.
