var express = require('express'),
    moment = require('moment'),
    cfenv = require('cfenv'),
    ServiceBroker = require('./service_broker'),
    KeyValueStore = require('./key_value_store');

class ServiceBrokerInterface {

    constructor() {
        // Check if persistence mode is enabled
        this.persistenceMode = (cfenv.getAppEnv().app.ENABLE_PERSISTENCE || process.env.ENABLE_PERSISTENCE) != null;
        if (this.persistenceMode) {
            this.token = cfenv.getAppEnv().app.KV_TOKEN || process.env.KV_TOKEN;
            this.key = cfenv.getAppEnv().app.KV_KEY_NAME || process.env.KV_KEY_NAME;
            if (!this.token) {
                console.error('Missing environmental variable: KV_TOKEN. Aborting.');
                process.exit(1);
                return;
            }
            if (!this.key) {
                console.error('Missing environmental variable: KV_KEY_NAME. Aborting.');
                process.exit(1);
                return;
            }
            this.keyValueStore = new KeyValueStore(this.token, this.key);
        }
        this.serviceBroker = new ServiceBroker();
        this.serviceInstances = {};
        this.lastRequest = {};
        this.lastResponse = {};
    }

    initData(callback) {
        this.loadData(callback);
    }

    loadData(callback) {
        // If persistence mode is disabled, do nothing
        if (!this.persistenceMode) {
            callback(true);
            return;
        }

        // If we're not in production mode, do nothing
        if (process.env.NODE_ENV == 'testing' || process.env.NODE_ENV == 'development') {
            callback(true);
            return;
        }

        // We're running in production mode with persistence enabled, so we need to load any saved state
        var self = this;
        this.keyValueStore.loadData(this.key, function(data) {
            self.serviceInstances = data || {};
            callback(true);
        });
    }

    saveData(callback) {
        // If persistence mode is disabled, do nothing
        if (!this.persistenceMode) {
            callback(true);
            return;
        }
        this.keyValueStore.saveData(this.key, this.serviceInstances, function(success) {
            if (!success) {
                console.error('Error saving data to key value store');
                if (callback != null) {
                    callback(false);
                }
                return;
            }
            if (callback != null) {
                callback(true);
            }
        });
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
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
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
        console.log('Creating service %s', serviceInstanceId);
        this.serviceInstances[serviceInstanceId] = {
            created: moment().toString(),
            api_version: request.header('X-Broker-Api-Version'),
            service_id: request.body.service_id,
            plan_id: request.body.plan_id,
            parameters: request.body.parameters || {},
            accepts_incomplete: request.body.requests_incomplete,
            organization_guid: request.body.organization_guid,
            space_guid: request.body.space_guid,
            context: request.body.context,
            bindings: {},
        };
        this.saveRequest(request);
        this.saveResponse({});
        var dashboardUrl = this.serviceBroker.getDashboardUrl();
        this.saveData(function(success) {
            response.json({
                dashboard_url: dashboardUrl
            });
        });
    }

    updateServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
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
        console.log('Updating service %s', serviceInstanceId);
        this.serviceInstances[serviceInstanceId].api_version = request.header('X-Broker-Api-Version'),
        this.serviceInstances[serviceInstanceId].service_id = request.body.service_id;
        this.serviceInstances[serviceInstanceId].plan_id = request.body.plan_id;
        this.serviceInstances[serviceInstanceId].parameters = request.body.parameters;
        this.serviceInstances[serviceInstanceId].context = request.body.context;
        this.serviceInstances[serviceInstanceId].last_updated = moment().toString();
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData(function(success) {
            response.json({});
        });
    }

    deleteServiceInstance(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkQuery('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('plan_id', 'Missing plan_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
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
        console.log('Deleting service %s', serviceInstanceId);
        delete this.serviceInstances[serviceInstanceId];
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData(function(success) {
            response.json({});
        });
    }

    createServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
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
        var bindingID = request.params.binding_id;
        console.log('Creating service binding %s for service %s', serviceInstanceId, bindingID);
        this.serviceInstances[serviceInstanceId]['bindings'][bindingID] = {
            api_version: request.header('X-Broker-Api-Version'),
            service_id: request.body.service_id,
            plan_id: request.body.plan_id,
            app_guid: request.body.app_guid,
            bind_resource: request.body.bind_resource,
            parameters: request.body.parameters
        };
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData(function(success) {
            response.json({ credentials: { username: 'admin', password: 'password' } });
        });
    }

    deleteServiceBinding(request, response) {
        request.checkParams('instance_id', 'Missing instance_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }

        var serviceInstanceId = request.params.instance_id;
        var bindingID = request.params.binding_id;
        console.log('Deleting service binding %s for service %s', serviceInstanceId, bindingID);
        try {
            delete this.serviceInstances[serviceInstanceId]['bindings'][bindingID];
        }
        catch (e) {
            // We must have lost this state
        }
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData(function(success) {
            response.json({});
        });
    }

    showDashboard(request, response) {
        var data = {
            title: 'Service Broker Overview',
            status: 'running',
            persistenceMode: this.persistenceMode,
            api_version: request.header('X-Broker-Api-Version'),
            serviceInstances: this.serviceInstances,
            lastRequest: this.lastRequest,
            lastResponse: this.lastResponse,
            catalog: this.serviceBroker.getCatalog()
        };
        response.render('dashboard', data);
    }

    clean(request, response) {
        this.serviceInstances = {};
        this.lastRequest = {};
        this.lastResponse = {};
        this.saveData(function(success) {
            response.json({});
        });
    }

    updateCatalog(request, response) {
        let data = request.body.catalog;
        let error = this.serviceBroker.setCatalog(data);
        if (error) {
            console.error(error);
            response.status(400).send('Error setting catalog data');
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
