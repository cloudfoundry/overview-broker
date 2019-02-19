# Overview Broker

| Job | Status |
| :-: | :----: |
| Unit | ![Unit status](http://ism.ci.cf-app.com/api/v1/teams/main/pipelines/best-broker/jobs/absolute-unit/badge) |
| Deploy | ![Deploy status](http://ism.ci.cf-app.com/api/v1/teams/main/pipelines/best-broker/jobs/deploy-best-broker/badge) |
| [Dockerhub](https://hub.docker.com/r/mattmcneeney/overview-broker) | ![Dockerhub status](http://ism.ci.cf-app.com/api/v1/teams/main/pipelines/best-broker/jobs/push-to-dockerhub/badge) |

A simple service broker conforming to the [Open Service Broker API](https://github.com/openservicebrokerapi/servicebroker/)
specification that hosts a dashboard showing information on service instances
and bindings created by any platform the broker is registered with.

Other fun features this broker provides include:
* Edit the broker catalog without redeploys to speed up testing
* History of recent requests and responses
* Ability to enable different error modes to test platform integrations
* Change the response mode on the fly (sync only/async only/async where possible)
* A range of configuration parameter schemas for provision service instance,
  update service instance and create service binding
* Asynchronous service instance provisions, updates and deletes
* Asynchronous service binding creates and deletes
* Fetching service instances and bindings
* Generic extensions for fetching the [Health](extensions/health.yaml) and
  [Info](extensions/info.yaml) for a service instance

### What is the Open Service Broker API?

![Open Service Broker API](images/openservicebrokerapi.png)

The [Open Service Broker API](https://www.openservicebrokerapi.org) project
allows developers, ISVs, and SaaS vendors a single, simple, and elegant way to
deliver services to applications running within cloud native platforms such as
Cloud Foundry, OpenShift, and Kubernetes. The project includes individuals from
Fujitsu, Google, IBM, Pivotal, RedHat and SAP.

### Quick start

#### Dockerhub

The latest version of `overview-broker` can always be found on
[Dockerhub](https://hub.docker.com/r/mattmcneeney/overview-broker). You can
pull and run the latest image with:
```bash
docker pull mattmcneeney/overview-broker
docker run mattmcneeney/overview-broker
```

#### Build it
```bash
git clone git@github.com:mattmcneeney/overview-broker.git
cd overview-broker
npm install

# Start overview-broker
npm start

# Or to run the tests
npm test
```

#### Configuration
* To set the BasicAuth credentials, set the `BROKER_USERNAME` and
  `BROKER_PASSWORD` environmental variables. Otherwise the defaults of `admin`
  and `password` will be used.
* To expose a syslog drain service, set the `SYSLOG_DRAIN_URL`
  environmental variable to a url.
* To expose a volume mount service, set the `EXPOSE_VOLUME_MOUNT_SERVICE`
  environmental variable to `true`.
* To generate many plans with a range of configuration parameter schemas, set
  the `ENABLE_EXAMPLE_SCHEMAS` environmental variable to `true`.
* By default, all asynchronous operations take 1 second to complete. To override
  this, set the `ASYNCHRONOUS_DELAY_IN_SECONDS` environmental variable to the
  number of seconds all operations should take.
* To specify how long platforms should wait before timing out an asynchronous
  operation, set the `MAXIMUM_POLLING_DURATION_IN_SECONDS` environmental
  variable.
* To specify how long Platforms should wait in between polling the
  `/last_operation` endpoint for service instances or bindings, set the
  `POLLING_INTERVAL_IN_SECONDS` environmental variable to the number of seconds
  a platform should wait before trying again.
* To change the name of the service(s) exposed by the service broker, set the
  `SERVICE_NAME` environmental variable.

---

### Platforms

#### Cloud Foundry

##### 1. Deploying the broker

* First you will need to deploy the broker as an application:
    ```bash
    cf push overview-broker -i 1 -m 256M -k 256M --random-route -b https://github.com/cloudfoundry/nodejs-buildpack
    ```
* You can also use an application manifest to deploy the broker as an
    application:
    ```bash
    wget https://raw.githubusercontent.com/mattmcneeney/overview-broker/master/examples/cloudfoundry/manifest.yaml
    cf push
    ```

##### 2. Registering the broker

* To register the broker to a space (does not require admin credentials), run:
    ```bash
    cf create-service-broker --space-scoped overview-broker admin password <url-of-deployed-broker>
    ```
    The basic auth credentials "admin" and "password" can be specified if needed
    (see [Configuration](#configuration)).
* The overview broker dashboard should now be accessible at
`https://<url-of-deployed-broker>/dashboard`.


##### 3. Creating a service instance

* Now for the exciting part... it's time to create a new service instance:
    ```bash
    cf create-service overview-service simple my-instance
    ```
    You can give your service a specific name in the dashboard by providing the
    `name` configuration parameter:
    ```bash
    cf create-service overview-service simple my-instance -c '{ "name": "My Service Instance" }'
    ```
* If you now head back to the dashboard, you should see your new service
instance information.

#### Kubernetes

##### 1. Deploying the broker

* If you want to deploy the broker on Kubernetes, you will first need to build an
image for the container. If you're using
[minikube](https://kubernetes.io/docs/getting-started-guides/minikube/), you
don't need to push the image to a registry. Instead you can just build the
image using the same Docker host as the minikube VM. To build a container using
the example [Dockerfile](/examples/kubernetes/Dockerfile) provided, run:
    ```bash
    wget https://raw.githubusercontent.com/mattmcneeney/overview-broker/master/examples/kubernetes/Dockerfile
    eval $(minikube docker-env)
    docker build -t overview-broker:v1 .
    ```
    If you already have Docker installed and running on your machine and want to
    use that daemon again, just run:
    ```bash
    eval $(minikube docker-env -u)
    ```
* Now it's time to create a deployment. A Kubernetes deployment manages a pod,
which we want to run our `overview-broker` image:
    ```bash
    kubectl run overview-broker --image=overview-broker:v1 --port=8080 --env="PORT=8080"
    ```
    You can check the deployment has succeeded by running `kubectl get deployments`
    and `kubectl get pods`.
* In order to access the Pod from outside of the Kubernetes virtual network, you
need to create a service. You can create a load balancer to do this easily:
    ```bash
    kubectl expose deployment overview-broker --type=LoadBalancer
    ```
* Check your service has been created successfully using `kubectl get services`.
    You should now be able to access the broker dashboard by running:
    ```bash
    minikube service overview-broker
    ```

##### 2. Registering the broker

To register the broker, you first need to install the Service Catalog using
Helm. _The instructions to do this are likely to change, so if anything below
breaks, then check out the [official guide](https://github.com/kubernetes-incubator/service-catalog/blob/master/docs/walkthrough.md)._

* If you don't already have Helm, then follow [these](https://github.com/kubernetes/helm/blob/master/docs/install.md)
installation instructions to install both Helm and Tiller. If you're on macOS,
the quickest way to do this is:
    ```bash
    brew install kubernetes-helm
    helm init
    ```
* The service catalog then needs to be installed and configured with:
    ```bash
    helm repo add svc-cat https://svc-catalog-charts.storage.googleapis.com
    kubectl create clusterrolebinding tiller-cluster-admin \
        --clusterrole=cluster-admin \
        --serviceaccount=kube-system:default

    # The helm install will fail if we run this immediately. Give tiller
    # some time to get ready...
    sleep 30
    helm install svc-cat/catalog \
        --name catalog --namespace catalog --set insecure=true
    ```
    If everything installed successfully, then you should see the following:
    ```bash
    $ kubectl get clusterservicebrokers
    No resources found.
    ```
* Finally, you need to register a broker server with the catalog by creating
a new Broker resource. Download the provided manifest (`overview-broker.yaml`)
to do this, but be sure to edit the file to update the URL of the broker you
have deployed (use the IP address returned by
`minikube service overview-broker --url`):
    ```bash
    wget https://raw.githubusercontent.com/mattmcneeney/overview-broker/master/examples/kubernetes/overview-broker.yaml
    # Update <URL> to the output of 'minikube service overview-broker --url'
    ```
    Now create the resource with:
    ```bash
    kubectl create -f overview-broker.yaml
    ```
    Check the status of the broker with:
    ```bash
    kubectl get clusterservicebrokers overview-broker -o yaml
    ```
    Your broker should also appear in the output from:
    ```bash
    kubectl get clusterserviceclasses
    ```

##### 3. Creating a service instance

Now that we have the `overview-broker` ServiceClass within our cluster's service
catalog, we can provision a new Instance resource.

* Download the provided manfifest (`overview-broker-instance.yaml`) and create
a new instance with:
    ```bash
    wget https://raw.githubusercontent.com/mattmcneeney/overview-broker/master/examples/kubernetes/overview-broker-instance.yaml
    kubectl create -f overview-broker-instance.yaml
    ```
    Check everything has worked with:
    ```bash
    kubectl get serviceinstances overview-broker-instance -o yaml
    ```
    You should see a message saying `"The instance was provisioned successfully"`.
* If you now head back to the dashboard (run `minikube service overview-broker`),
you should see your new service instance information!
