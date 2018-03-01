var express = require('express'),
    moment = require('moment'),
    cfenv = require('cfenv'),
    randomstring = require('randomstring'),
    Logger = require('./logger'),
    ServiceBroker = require('./service_broker');

class ServiceBrokerInterface {

    constructor() {
        this.serviceBroker = new ServiceBroker();
        this.logger = new Logger();
        this.serviceInstances = {};
        this.lastRequest = {};
        this.lastResponse = {};
        this.bindingCredentials = {
            username: 'admin',
            password: randomstring.generate(16)
        };
        this.instanceProvisionsInProgress = {};
        this.instanceUpdatesInProgress = {};
        this.bindingCreatesInProgress = {};
        this.instanceDeprovisionsInProgress = {};

        if (process.env.FAKE_DATA) {
            this.showFakeData()
        }
    }

    showFakeData() {
        this.serviceInstances['b1daaff9-1430-4b20-9846-cb2ae0987861'] = {
            created: moment().toString(),
            last_updated: 'never',
            service_id: '1',
            plan_id: '1',
            api_version: '2.13',
            parameters: {
                name: 'Cloud Foundry Service Instance',
                rainbow: true
            },
            context: { platform: 'cloudfoundry', space_guid: '15b5c1e9-5e2d-4afe-946a-4fbea279ccf8' }
        };
        this.serviceInstances['8aaf022d-ec8d-40aa-a22e-fa7f6c2b20f5'] = {
            created: moment().toString(),
            last_updated: 'never',
            service_id: '1',
            plan_id: '1',
            api_version: '2.13',
            parameters: {
                name: 'Kubernetes Service Instance'
            },
            context: { platform: 'kubernetes', namespace: 'dev' }
        };
    }

    checkRequest(request, response, next) {
        // Check for version header
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(412).send(errors);
            return;
        }
        next();
    }

    getCatalog(request, response) {
        var data = this.serviceBroker.getCatalog();
        this.saveRequest(request);
        this.saveResponse(data);
        response.json(data);
    }

    createServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkBody('organization_guid', 'Missing organization_guid').notEmpty();
        request.checkBody('space_guid', 'Missing space_guid').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        // Validate serviceId and planId
        var service = this.serviceBroker.getService(request.body.service_id);
        var plan = this.serviceBroker.getPlanForService(request.body.service_id, request.body.plan_id);
        if (!plan) {
            response.status(400).send(`Could not find service ${request.body.service_id}, plan ${request.body.plan_id}`);
            return;
        }

        // Validate any configuration parameters if we have a schema
        var schema = null;
        try {
            schema = plan.schemas.service_instance.create.parameters;
        }
        catch (e) {
            // No schema to validate with
        }
        if (schema) {
            var validationErrors = this.serviceBroker.validateParameters(schema, (request.body.parameters || {}));
            if (validationErrors) {
                response.status(400).send(validationErrors);
                return;
            }
        }

        // Create the service
        var serviceInstanceId = request.params.instance_id;
        this.logger.debug(`Creating service ${serviceInstanceId}`);

        this.saveRequest(request);
        this.saveResponse({});

        let dashboardUrl = this.serviceBroker.getDashboardUrl();
        let metricsUrl = `${cfenv.getAppEnv().url}/v2/service_instances/${serviceInstanceId}/metrics`;
        var data = {
            dashboard_url: dashboardUrl,
            metrics_url: metricsUrl
        };

        this.serviceInstances[serviceInstanceId] = {
            created: moment().toString(),
            last_updated: 'never',
            api_version: request.header('X-Broker-Api-Version'),
            service_id: request.body.service_id,
            service_name: service.name,
            plan_id: request.body.plan_id,
            plan_name: plan.name,
            parameters: request.body.parameters || {},
            accepts_incomplete: (request.query.accepts_incomplete == 'true'),
            organization_guid: request.body.organization_guid,
            space_guid: request.body.space_guid,
            context: request.body.context,
            bindings: {},
            data: data
        };

        if (request.query.accepts_incomplete == 'true' && process.env.responseMode == 'async') {
            // Set the end time for the operation to be one second from now
            // unless an explicit delay was requested
            var endTime = new Date();
            if (parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS)) {
               endTime.setSeconds(endTime.getSeconds() + parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS));
            }
            else {
               endTime.setSeconds(endTime.getSeconds() + 1);
            }
            this.instanceProvisionsInProgress[serviceInstanceId] = endTime;
            response.status(202).json(data);
            return;
        }

        // Else return the data synchronously
        response.json(data);
    }

    updateServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        // Validate serviceId and planId
        var plan = this.serviceBroker.getPlanForService(request.body.service_id, request.body.plan_id);
        if (!plan) {
            response.status(400).send('Could not find service %s, plan %s', request.body.service_id, request.body.plan_id);
            return;
        }

        // Validate any configuration parameters if we have a schema
        var schema = null;
        try {
            schema = plan.schemas.service_instance.update.parameters;
        }
        catch (e) {
            // No schema to validate with
        }
        if (schema) {
            var validationErrors = this.serviceBroker.validateParameters(schema, (request.body.parameters || {}));
            if (validationErrors) {
                response.status(400).send(validationErrors);
                return;
            }
        }

        var serviceInstanceId = request.params.instance_id;
        this.logger.debug(`Updating service ${serviceInstanceId}`);
        this.serviceInstances[serviceInstanceId].api_version = request.header('X-Broker-Api-Version'),
        this.serviceInstances[serviceInstanceId].service_id = request.body.service_id;
        this.serviceInstances[serviceInstanceId].plan_id = request.body.plan_id;
        this.serviceInstances[serviceInstanceId].parameters = request.body.parameters;
        this.serviceInstances[serviceInstanceId].context = request.body.context;
        this.serviceInstances[serviceInstanceId].last_updated = moment().toString();
        this.saveRequest(request);
        this.saveResponse({});

        if (request.query.accepts_incomplete == 'true' && process.env.responseMode == 'async') {
            // Set the end time for the operation to be one second from now
            // unless an explicit delay was requested
            var endTime = new Date();
            if (parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS)) {
               endTime.setSeconds(endTime.getSeconds() + parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS));
            }
            else {
               endTime.setSeconds(endTime.getSeconds() + 1);
            }
            this.instanceUpdatesInProgress[serviceInstanceId] = endTime;
            response.status(202).json({});
            return;
        }

        // Else return the data synchronously
        response.json({});
    }

    deleteServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkQuery('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        // Validate serviceId and planId
        var plan = this.serviceBroker.getPlanForService(request.query.service_id, request.query.plan_id);
        if (!plan) {
            // Just throw a warning in case the broker was restarted so the IDs changed
            console.warn('Could not find service %s, plan %s', request.query.service_id, request.query.plan_id);
        }

        var serviceInstanceId = request.params.instance_id;
        this.logger.debug(`Deleting service ${serviceInstanceId}`);
        delete this.serviceInstances[serviceInstanceId];

        if (request.query.accepts_incomplete == 'true' && process.env.responseMode == 'async') {
            // Set the end time for the operation to be one second from now
            // unless an explicit delay was requested
            var endTime = new Date();
            if (parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS)) {
               endTime.setSeconds(endTime.getSeconds() + parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS));
            }
            else {
               endTime.setSeconds(endTime.getSeconds() + 1);
            }
            this.instanceDeprovisionsInProgress[serviceInstanceId] = endTime;
            response.status(202).json({});
            return;
        }

        this.saveRequest(request);
        this.saveResponse({});
        response.json({});
    }

    createServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        // Validate serviceId and planId
        var service = this.serviceBroker.getService(request.body.service_id);
        if (!service) {
           response.status(400).send(`Could not find service ${request.body.service_id}`);
           return;
        }
        var plan = this.serviceBroker.getPlanForService(request.body.service_id, request.body.plan_id);
        if (!plan) {
            response.status(400).send(`Could not find service/plan ${request.body.service_id}/${request.body.plan_id}`);
            return;
        }

        // Validate any configuration parameters if we have a schema
        var schema = null;
        try {
            schema = plan.schemas.service_binding.create.parameters;
        }
        catch (e) {
            // No schema to validate with
        }
        if (schema) {
            var validationErrors = this.serviceBroker.validateParameters(schema, (request.body.parameters || {}));
            if (validationErrors) {
                response.status(400).send(validationErrors);
                return;
            }
        }

        var serviceInstanceId = request.params.instance_id;
        var bindingId = request.params.binding_id;
        this.logger.debug(`Creating service binding ${bindingId} for service ${serviceInstanceId}`);

        this.saveRequest(request);
        this.saveResponse({});

        var data = {};
        if (!service.requires || service.requires.length == 0) {
           data = {
              credentials: this.bindingCredentials
           };
        }
        else if (service.requires && service.requires.indexOf('syslog_drain') > -1) {
           data = {
              syslog_drain_url: 'http://ladida'
           };
        }
        else if (service.requires && service.requires.indexOf('volume_mount') > -1) {
           data = {
              driver: 'nfs',
              container_dir: '/tmp',
              mode: 'r',
              device_type: 'shared',
              device: {
                 volume_id: 1
              }
           };
        }

        this.serviceInstances[serviceInstanceId].bindings[bindingId] = {
            api_version: request.header('X-Broker-Api-Version'),
            service_id: request.body.service_id,
            plan_id: request.body.plan_id,
            app_guid: request.body.app_guid,
            bind_resource: request.body.bind_resource,
            parameters: request.body.parameters,
            data: data
        };

        if (request.query.accepts_incomplete == 'true' && process.env.responseMode == 'async') {
            // Set the end time for the operation to be one second from now
            // unless an explicit delay was requested
            var endTime = new Date();
            if (parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS)) {
               endTime.setSeconds(endTime.getSeconds() + parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS));
            }
            else {
               endTime.setSeconds(endTime.getSeconds() + 1);
            }
            this.bindingCreatesInProgress[bindingId] = endTime;
            response.status(202).json({});
            return;
        }

        // Else return the data synchronously
        response.json(data);
    }

    deleteServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkQuery('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        var serviceInstanceId = request.params.instance_id;
        var bindingId = request.params.binding_id;
        this.logger.debug(`Deleting service binding ${bindingId} for service ${serviceInstanceId}`);
        try {
            delete this.serviceInstances[serviceInstanceId].bindings[bindingId];
        }
        catch (e) {
            // We must have lost this state
        }

        if (request.query.accepts_incomplete == 'true' && process.env.responseMode == 'async') {
            // Set the end time for the operation to be one second from now
            // unless an explicit delay was requested
            var endTime = new Date();
            if (parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS)) {
               endTime.setSeconds(endTime.getSeconds() + parseInt(process.env.ASYNCHRONOUS_DELAY_IN_SECONDS));
            }
            else {
               endTime.setSeconds(endTime.getSeconds() + 1);
            }
            this.bindingCreatesInProgress[bindingId] = endTime;
            response.status(202).json({});
            return;
        }

        this.saveRequest(request);
        this.saveResponse({});
        response.json({});
    }

    getLastServiceInstanceOperation(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        // We should know about the operation
        var serviceInstanceId = request.params.instance_id;
        var finishTime = this.instanceProvisionsInProgress[serviceInstanceId] || this.instanceUpdatesInProgress[serviceInstanceId] || this.instanceDeprovisionsInProgress[serviceInstanceId] || null;
        // But if we don't, presume that the operation finished and we have forgotten about it
        if (!finishTime) {
           var data = { state: 'succeeded', description: 'The operation has completed (although it had been forgotten about).' };
           response.json(data);
           this.saveRequest(request);
           this.saveResponse(data);
           return;
        }

        // Check if the operation is still going
        var data = {};
        if (finishTime >= new Date()) {
           data.state = 'in progress';
           data.description = 'The operation is in progress...';
        }
        else {
           data.state = 'succeeded';
           data.description = 'The operation has finished!';

           // Since it has finished, we should forget about the operation
           delete this.instanceProvisionsInProgress[serviceInstanceId];
           delete this.instanceUpdatesInProgress[serviceInstanceId];
           delete this.instanceDeprovisionsInProgress[serviceInstanceId];
        }
        this.saveRequest(request);
        this.saveResponse(data);
        response.json(data);
    }

    getLastServiceBindingOperation(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        // We should know about the operation
        var serviceBindingId = request.params.binding_id;
        var finishTime = this.bindingCreatesInProgress[serviceBindingId] || null;
        // But if we don't, presume that the operation finished and we have forgotten about it
        if (!finishTime) {
           var data = { state: 'succeeded', description: 'The operation has completed (although it had been forgotten about).' };
           response.json(data);
           return;
        }

        // Check if the operation is still going
        var data = {};
        if (finishTime >= new Date()) {
           data.state = 'in progress';
           data.description = 'The operation is in progress...';
        }
        else {
           data.state = 'succeeded';
           data.description = 'The operation has finished!';

           // Since it has finished, we should forget about the operation
           delete this.bindingCreatesInProgress[serviceBindingId];
        }
        this.saveRequest(request);
        this.saveResponse(data);
        response.json(data);
    }

    getServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            response.status(404).send(`Could not find service instance ${serviceInstanceId}`);
            return;
        }

        var data = Object.assign({}, this.serviceInstances[serviceInstanceId].data);
        data.service_id = this.serviceInstances[serviceInstanceId].service_id;
        data.plan_id = this.serviceInstances[serviceInstanceId].plan_id;
        data.parameters = this.serviceInstances[serviceInstanceId].parameters;

        this.saveRequest(request);
        this.saveResponse(data);
        response.json(data);
    }

    getServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        let serviceBindingId = request.params.binding_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            response.status(404).send(`Could not find service instance ${serviceInstanceId}`);
            return;
        }
        if (!this.serviceInstances[serviceInstanceId].bindings[serviceBindingId]) {
            response.status(404).send(`Could not find service binding ${serviceBindingId}`);
            return;
        }

        var data = Object.assign({}, this.serviceInstances[serviceInstanceId].bindings[serviceBindingId].data);
        data.parameters = this.serviceInstances[serviceInstanceId].bindings[serviceBindingId].parameters;

        this.saveRequest(request);
        this.saveResponse(data);
        response.json(data);
    }

    getDashboardData() {
        return {
            title: 'Overview Broker',
            status: 'running',
            serviceInstances: this.serviceInstances,
            lastRequest: this.lastRequest,
            lastResponse: this.lastResponse,
            catalog: this.serviceBroker.getCatalog()
        };
    }

    getMetrics(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            response.status(404).send(`Could not find service instance ${serviceInstanceId}`);
            return;
        }

        let serviceInstance = this.serviceInstances[serviceInstanceId];

        let metrics = `
# HELP alive Counting service instances that are responding
# TYPE alive gauge
alive {service_instance="${request.params.instance_id}", service_name="${serviceInstance.service_name}", plan_name="${serviceInstance.plan_name}"} 1 ${new Date().getTime() }

# HELP health The service instance is healthy
# TYPE health gauge
health{service_instance="${request.params.instance_id}", service_name="${serviceInstance.service_name}", plan_name="${serviceInstance.plan_name}"} ${Math.round(Math.random() * 1)} ${new Date().getTime() }

# HELP cpu The service instance CPU load
# TYPE cpu gauge
cpu{service_instance="${request.params.instance_id}", service_name="${serviceInstance.service_name}", plan_name="${serviceInstance.plan_name}"} ${Math.floor(Math.random() * 100)} ${new Date().getTime() }

# HELP total_requests Total requests to the service instance
# TYPE total_requests counter
total_requests{service_instance="${request.params.instance_id}", service_name="${serviceInstance.service_name}", plan_name="${serviceInstance.plan_name}"} ${new Date().getSeconds()} ${new Date().getTime() }
        `;
        response.send(metrics);
    }

    listInstances(request, response) {
        var data = {};
        var serviceInstances = this.serviceInstances;
        Object.keys(serviceInstances).forEach(function(key) {
            data[key] = serviceInstances[key].data;
        });
        response.json(data);
    }

    clean(request, response) {
        this.serviceInstances = {};
        this.lastRequest = {};
        this.lastResponse = {};
        response.json({});
    }

    updateCatalog(request, response) {
        let data = request.body.catalog;
        let error = this.serviceBroker.setCatalog(data);
        if (error) {
            response.status(400).send(error);
            return;
        }
        response.json({});
    }

    saveRequest(request) {
        this.lastRequest = {
            url: request.url,
            method: request.method,
            body: request.body,
            headers: request.headers
        };
    }

    saveResponse(data) {
        this.lastResponse = data;
    }

    getServiceBroker() {
        return this.serviceBroker;
    }

}

module.exports = ServiceBrokerInterface;
