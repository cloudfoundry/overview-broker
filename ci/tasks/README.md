# Tasks

Note that the `conformance.yml` task uses the `mattmcneeney/jdk-11-node-10`
Docker image. The `Dockerfile.jdk-11-node-10` file in this directory was the
Dockerfile used to build that image with.

To rebuild the image:
```
docker build -f Dockerfile.jdk-11-node-10 -t mattmcneeney/jdk-11-node-10 . &&
docker push jdk-11-node-10
```
