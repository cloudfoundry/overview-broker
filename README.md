# Overview Broker
[![Build Status](https://travis-ci.org/mattmcneeney/overview-broker.svg?branch=master)](https://travis-ci.org/mattmcneeney/overview-broker)

A simple service broker conforming to the [Open Service Broker API specification](https://github.com/openservicebrokerapi/servicebroker/) that hosts a dashboard showing information on service instances and bindings created by any platform the broker is registered with.

### Installation
```bash
npm install
```

### Running
```bash
npm start
```

Overview Broker can provide persistence using the free [keyvalue.xyz](https://keyvalue.xyz/) service. For the broker to start up successfully in persistence mode, you must provide the following environment variables:
* `ENABLE_PERSISTENCE`: set to `true`
* `KV_TOKEN`: the [token](https://github.com/kvaas/docs/blob/master/REST%20API.md#post-newkey) used to set and get the key value pair
* `KV_KEY_NAME`: the key name

You can create a new token (`KV_TOKEN`) using the following command. The token will be included in the response before the name of your key:
```bash
$ curl -X POST https://api.keyvalue.xyz/new/KEY_NAME
https://api.keyvalue.xyz/TOKEN/KEY_NAME
```

You should then set `KV_TOKEN` to `TOKEN` and `KV_KEY_NAME` to `KEY_NAME`.

### Tests

To run the test suite:
```bash
npm test
```

---

### Platforms

#### Cloud Foundry

First you will need to deploy the broker as an application:
```bash
cf push overview-broker --no-start
```

Then enable persistence mode if required:
```bash
cf set-env overview-broker ENABLE_PERSISTENCE true
cf set-env overview-broker KV_TOKEN <TOKEN>
cf set-env overview-broker KV_KEY_NAME <KEY_NAME>
cf restage overview-broker
```

Then to register the broker:
```bash
cf create-service-broker --space-scoped overview-broker admin password <url-of-deployed-broker>
```

The overview broker dashboard should now be accessible at `https://<url-of-deployed-broker>/dashboard`.

If you now go ahead and create a new service instance, the instance should appear live in the dashboard:
```bash
cf create-service overview-broker default my-broker
```


#### Kubernetes

