# Image

The `conformance.yml` task uses the `mattmcneeney/jdk-11-node-10`
Docker image. The `Dockerfile.jdk-11-node-10` file is what is used to build
that image.

To rebuild the image if required (e.g. after changing the Dockerfile):
```
docker build -f Dockerfile.jdk-11-node-10 -t mattmcneeney/jdk-11-node-10 . &&
docker push jdk-11-node-10
```
