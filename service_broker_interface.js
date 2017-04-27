var express = require('express'),
    moment = require('moment'),
    ServiceBroker = require('./service_broker');

class ServiceBrokerInterface {

    constructor() {
        this.serviceBroker = new ServiceBroker();
        this.serviceInstances = {};
    }

    getCatalog(request, response) {
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
        response.json(data);
    }

    createServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkBody('organization_guid', 'Missing organization_guid').notEmpty();
        request.checkBody('space_guid', 'Missing space_guid').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceID = request.params.service_id;
        console.log('Creating service %s', serviceID);
        this.serviceInstances[serviceID] = {
            timestamp: moment().toString(),
            serviceID: request.body.service_id,
            planID: request.body.plan_id,
            parameters: request.body.parameters,
            accepts_incomplete: request.body.requests_incomplete,
            organization_guid: request.body.organization_guid,
            space_guid: request.body.space_guid,
            context: request.body.context,
            bindings: {}
        };
        response.json({});
    }

    updateServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceID = request.params.service_id;
        console.log('Updating service %s', serviceID);
        this.serviceInstances[serviceID].serviceID = request.body.service_id;
        this.serviceInstances[serviceID].plan_id = request.body.plan_id;
        this.serviceInstances[serviceID].parameters = request.body.parameters;
        response.json({});
    }

    deleteServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceID = request.params.service_id;
        console.log('Deleting service %s', serviceID);
        delete this.serviceInstances[serviceID];
        response.json({});
    }

    createServiceBinding(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceID = request.params.service_id;
        var bindingID = request.params.binding_id;
        console.log('Creating service binding %s for service %s', serviceID, bindingID);
        this.serviceInstances[serviceID]['bindings'][bindingID] = {
            service_id: request.body.service_id,
            plan_id: request.body.plan_id,
            app_guid: request.body.app_guid,
            bind_resource: request.body.bind_resource,
            parameters: request.body.parameters
        };
        response.json({});
    }

    deleteServiceBinding(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkParams('binding_id', 'Missing binding_id').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var serviceID = request.params.service_id;
        var bindingID = request.params.binding_id;
        console.log('Deleting service binding %s for service %s', serviceID, bindingID);
        delete this.serviceInstances[serviceID]['bindings'][bindingID];
        response.json({});
    }

    showDashboard(request, response) {
        var data = {
            title: 'Service Broker Overview',
            status: 'running',
            api_version: request.header('X-Broker-Api-Version'),
            serviceInstances: this.serviceInstances,
            serviceBindings: this.serviceBindings
        };
        response.render('dashboard', data);
    }

}

module.exports = ServiceBrokerInterface;
