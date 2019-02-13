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
        this.latestRequests = [];
        this.latestResponses = [];
        this.bindingCredentials = {
            username: 'admin',
            password: randomstring.generate(16)
        };
        this.instanceProvisionsInProgress = {};
        this.instanceUpdatesInProgress = {};
        this.bindingCreatesInProgress = {};
        this.instanceDeprovisionsInProgress = {};
        this.numRequestsToSave = 5;
        this.numResponsesToSave = 5;
    }

    checkRequest(request, response, next) {
        // Check for version header
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 412, errors);
            return;
        }
        next();
    }

    getCatalog(request, response) {
        var data = this.serviceBroker.getCatalog();
        this.sendJSONResponse(response, 200, data);
    }

    createServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkBody('organization_guid', 'Missing organization_guid').notEmpty();
        request.checkBody('space_guid', 'Missing space_guid').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        // Validate serviceId and planId
        var service = this.serviceBroker.getService(request.body.service_id);
        var plan = this.serviceBroker.getPlanForService(request.body.service_id, request.body.plan_id);
        if (!plan) {
            this.sendResponse(response, 400, `Could not find service ${request.body.service_id}, plan ${request.body.plan_id}`);
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
                this.sendResponse(response, 400, validationErrors);
                return;
            }
        }

        // Create the service instance
        var serviceInstanceId = request.params.instance_id;
        this.logger.debug(`Creating service instance ${serviceInstanceId}`);

        let dashboardUrl = `${this.serviceBroker.getDashboardUrl()}?time=${new Date().toISOString()}`;
        let data = {
            dashboard_url: dashboardUrl
        };

        // Check if the instance already exists
        if (serviceInstanceId in this.serviceInstances) {
            this.sendJSONResponse(response, 200, data);
            return;
        }

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
            context: request.body.context || {},
            bindings: {},
            data: data
        };

        if (process.env.responseMode == 'asyncalways' && request.query.accepts_incomplete != 'true') {
            this.sendJSONResponse(response, 422, { error: 'AsyncRequired' } );
            return;
        }

        if ((request.query.accepts_incomplete == 'true' && (process.env.responseMode == 'async') || process.env.responseMode == 'asyncalways')) {
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
            this.sendJSONResponse(response, 202, data);
            return;
        }

        // Else return the data synchronously
        this.sendJSONResponse(response, 201, data);
    }

    updateServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        // Validate serviceId and planId
        var plan = this.serviceBroker.getPlanForService(request.body.service_id, request.body.plan_id);
        if (!plan) {
            this.sendResponse(response, 400, 'Could not find service %s, plan %s', request.body.service_id, request.body.plan_id);
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
                this.sendResponse(response, 400, validationErrors);
                return;
            }
        }

        var serviceInstanceId = request.params.instance_id;
        this.logger.debug(`Updating service ${serviceInstanceId}`);
        this.serviceInstances[serviceInstanceId].api_version = request.header('X-Broker-Api-Version'),
        this.serviceInstances[serviceInstanceId].service_id = request.body.service_id;
        this.serviceInstances[serviceInstanceId].plan_id = request.body.plan_id;
        this.serviceInstances[serviceInstanceId].parameters = request.body.parameters || {};
        this.serviceInstances[serviceInstanceId].context = request.body.context || {};
        this.serviceInstances[serviceInstanceId].last_updated = moment().toString();

        let dashboardUrl = `${this.serviceBroker.getDashboardUrl()}?time=${new Date().toISOString()}`;
        let data = {
            dashboard_url: dashboardUrl
        };

        if (process.env.responseMode == 'asyncalways' && request.query.accepts_incomplete != 'true') {
            this.sendJSONResponse(response, 422, { error: 'AsyncRequired' } );
            return;
        }

        if ((request.query.accepts_incomplete == 'true' && (process.env.responseMode == 'async') || process.env.responseMode == 'asyncalways')) {
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
            this.sendJSONResponse(response, 202, data);
            return;
        }

        // Else return the data synchronously
        this.sendJSONResponse(response, 200, data);
    }

    deleteServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkQuery('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
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
        if (serviceInstanceId in this.serviceInstances) {
           delete this.serviceInstances[serviceInstanceId];
        } else {
            this.sendJSONResponse(response, 410, {});
            return;
        }

        if (process.env.responseMode == 'asyncalways' && request.query.accepts_incomplete != 'true') {
            this.sendJSONResponse(response, 422, { error: 'AsyncRequired' } );
            return;
        }

        if ((request.query.accepts_incomplete == 'true' && (process.env.responseMode == 'async') || process.env.responseMode == 'asyncalways')) {
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
            this.sendJSONResponse(response, 202, {});
            return;
        }

        this.sendJSONResponse(response, 200, {});
    }

    createServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        // Validate serviceId and planId
        var service = this.serviceBroker.getService(request.body.service_id);
        if (!service) {
            this.sendResponse(response, 400, `Could not find service ${request.body.service_id}`);
            return;
        }
        var plan = this.serviceBroker.getPlanForService(request.body.service_id, request.body.plan_id);
        if (!plan) {
            this.sendResponse(response, 400, `Could not find service/plan ${request.body.service_id}/${request.body.plan_id}`);
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
                this.sendResponse(response, 400, validationErrors);
                return;
            }
        }

        var serviceInstanceId = request.params.instance_id;
        var bindingId = request.params.binding_id;

        this.logger.debug(`Creating service binding ${bindingId} for service ${serviceInstanceId}`);

        var data = {};
        if (!service.requires || service.requires.length == 0) {
            data = {
                credentials: this.bindingCredentials
            };
        }
        else if (service.requires && service.requires.indexOf('syslog_drain') > -1) {
            data = {
                syslog_drain_url: process.env.SYSLOG_DRAIN_URL
            };
        }
        else if (service.requires && service.requires.indexOf('volume_mount') > -1) {
            data = {
                volume_mounts: [{
                    driver: 'nfs',
                    container_dir: '/tmp',
                    mode: 'r',
                    device_type: 'shared',
                    device: {
                        volume_id: '1'
                    }
                }]
            };
        }

        // Check if the binding already exists
        if (serviceInstanceId in this.serviceInstances && bindingId in this.serviceInstances[serviceInstanceId].bindings) {
            this.sendJSONResponse(response, 200, data);
            return;
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

        if (process.env.responseMode == 'asyncalways' && request.query.accepts_incomplete != 'true') {
            this.sendJSONResponse(response, 422, { error: 'AsyncRequired' } );
            return;
        }

        if ((request.query.accepts_incomplete == 'true' && (process.env.responseMode == 'async') || process.env.responseMode == 'asyncalways')) {
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
            this.sendJSONResponse(response, 202, {});
            return;
        }

        // Else return the data synchronously
        this.sendJSONResponse(response, 201, data);
    }

    deleteServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkQuery('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        var serviceInstanceId = request.params.instance_id;
        var bindingId = request.params.binding_id;
        this.logger.debug(`Deleting service binding ${bindingId} for service ${serviceInstanceId}`);
        if (serviceInstanceId in this.serviceInstances && bindingId in this.serviceInstances[serviceInstanceId].bindings) {
            delete this.serviceInstances[serviceInstanceId].bindings[bindingId];
        }
        else {
            this.sendJSONResponse(response, 410, {});
            return;
        }

        if (process.env.responseMode == 'asyncalways' && request.query.accepts_incomplete != 'true') {
            this.sendJSONResponse(response, 422, { error: 'AsyncRequired' } );
            return;
        }

        if ((request.query.accepts_incomplete == 'true' && (process.env.responseMode == 'async') || process.env.responseMode == 'asyncalways')) {
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
            this.sendJSONResponse(response, 202, {});
            return;
        }

        this.sendJSONResponse(response, 200, {});
    }

    getLastServiceInstanceOperation(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        // We should know about the operation
        var serviceInstanceId = request.params.instance_id;
        var finishTime = this.instanceProvisionsInProgress[serviceInstanceId] || this.instanceUpdatesInProgress[serviceInstanceId] || this.instanceDeprovisionsInProgress[serviceInstanceId] || null;
        // But if we don't, presume that the operation finished and we have forgotten about it
        if (!finishTime) {
            var data = { state: 'succeeded', description: 'The operation has completed (although it had been forgotten about).' };
            this.sendJSONResponse(response, 200, data);
            return;
        }

        // Check if the operation is still going
        var data = {};
        if (finishTime >= new Date()) {
            data.state = 'in progress';
            data.description = 'The operation is in progress...';

            // Check if we should add a Retry-After header
            if (parseInt(process.env.POLLING_INTERVAL_IN_SECONDS)) {
                response.append('Retry-After', parseInt(process.env.POLLING_INTERVAL_IN_SECONDS));
            }
        }
        else {
            if (process.env.errorMode == 'failasync') {
                data.state = 'failed';
                data.description = 'The operation has failed (failasync error mode enabled)';
            }
            else {
                data.state = 'succeeded';
                data.description = 'The operation has finished!';
            }

            // Since it has finished, we should forget about the operation
            delete this.instanceProvisionsInProgress[serviceInstanceId];
            delete this.instanceUpdatesInProgress[serviceInstanceId];
            delete this.instanceDeprovisionsInProgress[serviceInstanceId];
        }
        this.sendJSONResponse(response, 200, data);
    }

    getLastServiceBindingOperation(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        // We should know about the operation
        var serviceBindingId = request.params.binding_id;
        var finishTime = this.bindingCreatesInProgress[serviceBindingId] || null;
        // But if we don't, presume that the operation finished and we have forgotten about it
        if (!finishTime) {
            var data = { state: 'succeeded', description: 'The operation has completed (although it had been forgotten about).' };
            this.sendJSONResponse(response, 200, data);
            return;
        }

        // Check if the operation is still going
        var data = {};
        if (finishTime >= new Date()) {
            data.state = 'in progress';
            data.description = 'The operation is in progress...';

            // Check if we should add a Retry-After header
            if (parseInt(process.env.POLLING_INTERVAL_IN_SECONDS)) {
                response.append('Retry-After', parseInt(process.env.POLLING_INTERVAL_IN_SECONDS));
            }
        }
        else {
            if (process.env.errorMode == 'failasync') {
                data.state = 'failed';
                data.description = 'The operation has failed (failasync error mode enabled)';
            }
            else {
                data.state = 'succeeded';
                data.description = 'The operation has finished!';
            }

            // Since it has finished, we should forget about the operation
            delete this.bindingCreatesInProgress[serviceBindingId];
        }

        this.sendJSONResponse(response, 200, data);
    }

    getServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            this.sendResponse(response, 404, `Could not find service instance ${serviceInstanceId}`);
            return;
        }

        var data = Object.assign({}, this.serviceInstances[serviceInstanceId].data);
        data.service_id = this.serviceInstances[serviceInstanceId].service_id;
        data.plan_id = this.serviceInstances[serviceInstanceId].plan_id;
        data.parameters = this.serviceInstances[serviceInstanceId].parameters;

        this.sendJSONResponse(response, 200, data);
    }

    getServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        let serviceBindingId = request.params.binding_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            this.sendResponse(response, 404, `Could not find service instance ${serviceInstanceId}`);
            return;
        }
        if (!this.serviceInstances[serviceInstanceId].bindings[serviceBindingId]) {
            this.sendResponse(response, 404, `Could not find service binding ${serviceBindingId}`);
            return;
        }

        var data = Object.assign({}, this.serviceInstances[serviceInstanceId].bindings[serviceBindingId].data);
        data.parameters = this.serviceInstances[serviceInstanceId].bindings[serviceBindingId].parameters;

        this.sendJSONResponse(response, 200, data);
    }

    getDashboardData() {
        return {
            title: 'Overview Broker',
            status: 'running',
            serviceInstances: this.serviceInstances,
            latestRequests: this.latestRequests.slice().reverse(),
            latestResponses: this.latestResponses.slice().reverse(),
            catalog: this.serviceBroker.getCatalog(),
            env: {
                BROKER_USERNAME: process.env.BROKER_USERNAME || 'admin',
                BROKER_PASSWORD: process.env.BROKER_PASSWORD || 'password',
                SYSLOG_DRAIN_URL: process.env.SYSLOG_DRAIN_URL,
                EXPOSE_VOLUME_MOUNT_SERVICE: process.env.EXPOSE_VOLUME_MOUNT_SERVICE,
                ENABLE_EXAMPLE_SCHEMAS: process.env.ENABLE_EXAMPLE_SCHEMAS,
                ASYNCHRONOUS_DELAY_IN_SECONDS: process.env.ASYNCHRONOUS_DELAY_IN_SECONDS,
                MAXIMUM_POLLING_DURATION_IN_SECONDS: process.env.MAXIMUM_POLLING_DURATION_IN_SECONDS,
                POLLING_INTERVAL_IN_SECONDS: process.env.POLLING_INTERVAL_IN_SECONDS,
                SERVICE_NAME: process.env.SERVICE_NAME
            }
        };
    }

    getHealth(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            this.sendJSONResponse(response, 200, { alive: false });
            return;
        }

        this.sendJSONResponse(response, 200, { alive: true });
    }

    getInfo(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            this.sendResponse(response, 404, `Could not find service instance ${serviceInstanceId}`);
            return;
        }

        let data = {
            server_url: cfenv.getAppEnv().url,
            npm_config_node_version: process.env.npm_config_node_version,
            npm_package_version: process.env.npm_package_version,
        };
        this.sendJSONResponse(response, 200, data);
    }

    getLogs(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            this.sendResponse(response, 400, errors);
            return;
        }

        let serviceInstanceId = request.params.instance_id;
        if (!this.serviceInstances[serviceInstanceId]) {
            this.sendResponse(response, 404, `Could not find service instance ${serviceInstanceId}`);
            return;
        }


        this.sendJSONResponse(response, 200, data);
    }

    listInstances(request, response) {
        var data = {};
        var serviceInstances = this.serviceInstances;
        Object.keys(serviceInstances).forEach(function(key) {
            data[key] = serviceInstances[key].data;
        });
        this.sendJSONResponse(response, 200, data);
    }

    clean(request, response) {
        this.serviceInstances = {};
        this.latestRequests = [];
        this.latestResponses = [];
        response.status(200).json({});
    }

    updateCatalog(request, response) {
        let data = request.body.catalog;
        let error = this.serviceBroker.setCatalog(data);
        if (error) {
            this.sendResponse(response, 400, error);
            return;
        }
        this.sendJSONResponse(response, 200, {});
    }

    saveRequest(request) {
        this.latestRequests.push({
            timestamp: moment().toString(),
            data: {
                url: request.url,
                method: request.method,
                body: request.body,
                headers: request.headers
            }
        });
        if (this.latestRequests.length > this.numRequestsToSave) {
            this.latestRequests.shift();
        }
    }

    saveResponse(httpCode, data, headers) {
        this.latestResponses.push({
            timestamp: moment().toString(),
            data: {
                code: httpCode,
                headers: headers,
                body: data
            }
        });
        if (this.latestResponses.length > this.numResponsesToSave) {
            this.latestResponses.shift();
        }
    }

    sendResponse(response, httpCode, data) {
        response.status(httpCode).send(data);
        this.saveResponse(httpCode, data, response.getHeaders());
    }

    sendJSONResponse(response, httpCode, data) {
        response.status(httpCode).json(data);
        this.saveResponse(httpCode, data, response.getHeaders());

    }

    getServiceBroker() {
        return this.serviceBroker;
    }

}

module.exports = ServiceBrokerInterface;
