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
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var data = {
            services: [
                {
                    name: this.serviceBroker.getName(),
                    description: this.serviceBroker.getDescription(),
                    id: this.serviceBroker.getID(),
                    tags: this.serviceBroker.getTags(),
                    bindable: this.serviceBroker.getBindable(),
                    plan_updateable: true,
                    plans: this.serviceBroker.getPlans()
                }
            ]
        };
        this.saveRequest(request);
        this.saveResponse(data);
        response.json(data);
    }

    createServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
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
        var serviceId = request.params.service_id;
        console.log('Creating service %s', serviceId);
        this.serviceInstances[serviceId] = {
            created: moment().toString(),
            api_version: request.header('X-Broker-Api-Version'),
            service_id: request.body.service_id,
            plan_id: request.body.plan_id,
            parameters: request.body.parameters,
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
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        console.log('Updating service %s', serviceId);
        this.serviceInstances[serviceId].api_version = request.header('X-Broker-Api-Version'),
        this.serviceInstances[serviceId].service_id = request.body.service_id;
        this.serviceInstances[serviceId].plan_id = request.body.plan_id;
        this.serviceInstances[serviceId].parameters = request.body.parameters;
        this.serviceInstances[serviceId].context = request.body.context;
        this.serviceInstances[serviceId].last_updated = moment().toString();
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData(function(success) {
            response.json({});
        });
    }

    deleteServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('service_id', 'Missing service_id').notEmpty();
        request.checkQuery('plan_id', 'Missing plan_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        console.log('Deleting service %s', serviceId);
        delete this.serviceInstances[serviceId];
        this.saveRequest(request);
        this.saveResponse({});
        this.saveData(function(success) {
            response.json({});
        });
    }

    createServiceBinding(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        var bindingID = request.params.binding_id;
        console.log('Creating service binding %s for service %s', serviceId, bindingID);
        this.serviceInstances[serviceId]['bindings'][bindingID] = {
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
            response.json({ 'credentials': { 'username': 'admin', 'password': 'secret' } });
        });
    }

    deleteServiceBinding(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceId = request.params.service_id;
        var bindingID = request.params.binding_id;
        console.log('Deleting service binding %s for service %s', serviceId, bindingID);
        try {
            delete this.serviceInstances[serviceId]['bindings'][bindingID];
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
            lastResponse: this.lastResponse
        };
        response.render('dashboard', data);
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

}

module.exports = ServiceBrokerInterface;
