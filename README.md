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

Overview Broker provides persistence using the free [keyvalue.xyz](https://keyvalue.xyz/) service. For the broker to start up successfully, you need to provide two environment variables:
* `KV_TOKEN`: the [token](https://github.com/kvaas/docs/blob/master/REST%20API.md#post-newkey) used to set and get the key value pair
* `KV_KEY_NAME`: the key name

You can create a new token with the following command. The token will be included in the response before the name of your key.
```bash
$ curl -X POST https://api.keyvalue.xyz/new/KEY_NAME
https://api.keyvalue.xyz/TOKEN/KEY_NAME
```

You should then set `KV_TOKEN` to `TOKEN` and `KV_KEY_NAME` to `KEY_NAME`. If you are running your broker in Cloud Foundry, this can be done with:
```bash
cf set-env APP_NAME KV_TOKEN <TOKEN>
cf set-env APP_NAME KV_KEY_NAME <KEY_NAME>
cf restage APP_NAME
```

### Tests

To run the test suite:
```bash
npm test
```
