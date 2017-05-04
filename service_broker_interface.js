var express = require('express'),
    moment = require('moment'),
    MongoClient = require('mongodb').MongoClient,
    ServiceBroker = require('./service_broker');

class ServiceBrokerInterface {

    constructor() {
        this.serviceBroker = new ServiceBroker();
        this.db = null;
        this.serviceInstancesCollection = null;
    }

    setupDatabase(callback) {
        var self = this;
        MongoClient.connect('mongodb://mmcneeney:n$z3k4LHi5F32Z0Q@ds129610.mlab.com:29610/overview-broker', function(err, db) {
            if (err) {
                console.error('Error connecting to database: ' + err);
                callback(false);
                return;
            }
            self.db = db;
            self.serviceInstancesCollection = db.collection('service-instances-' + process.env.NODE_ENV);
            callback(true);
        });
    }

    cleanupDatabase(callback) {
        this.serviceInstancesCollection.remove({}, function(err, numberOfRemovedDocs) {
            if (err) {
                callback(err);
                done();
            }
            console.log(numberOfRemovedDocs + ' docs removed');
            callback();
        });
    }

    getCatalog(request, response) {
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
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
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var service_id = request.params.service_id;
        console.log('Creating service %s', service_id);
        this.serviceInstancesCollection.updateOne(
        {
            service_id: service_id
        },
        {
            'timestamp': moment().toString(),
            'api_version': request.header('X-Broker-Api-Version'),
            'service_id': request.body.service_id,
            'plan_id': request.body.plan_id,
            'parameters': request.body.parameters,
            'accepts_incomplete': request.body.requests_incomplete,
            'organization_guid': request.body.organization_guid,
            'space_guid': request.body.space_guid,
            'context': request.body.context,
            'bindings': []
        },
        {
            upsert: true
        },
        function(err, result) {
            if (err) {
                response.status(500).send('Error updating database');
                return;
            }
            response.json({});
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
        var service_id = request.params.service_id;
        console.log('Updating service %s', service_id);
        this.serviceInstancesCollection.updateOne(
        {
            service_id: service_id
        },
        {
            'api_version': request.header('X-Broker-Api-Version'),
            'service_id': request.body.service_id,
            'plan_id': request.body.plan_id,
            'parameters': request.body.parameters
        },
        {
            upsert: true
        },
        function(err, result) {
            if (err) {
                response.status(500).send('Error updating database');
                return;
            }
            response.json({});
        });
    }

    deleteServiceInstance(request, response) {
        request.checkParams('service_id', 'Missing service_id').notEmpty();
        request.checkBody('service_id', 'Missing service_id').notEmpty();
        request.checkBody('plan_id', 'Missing plan_id').notEmpty();
        request.checkHeaders('X-Broker-Api-Version', 'Missing broker api version').notEmpty();
        var errors = request.validationErrors();
        if (errors) {
            response.status(400).send(errors);
            return;
        }
        var service_id = request.params.service_id;
        console.log('Deleting service %s', service_id);
        this.serviceInstancesCollection.deleteOne(
        {
            service_id: service_id
        },
        function(err, result) {
            if (err) {
                response.status(500).send('Error updating database');
                return;
            }
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
        var service_id = request.params.service_id;
        var binding_id = request.params.binding_id;
        console.log('Creating service binding %s for service %s', service_id, binding_id);
        this.serviceInstancesCollection.updateOne(
        {
            service_id: service_id
        },
        {
            $push: {
                'bindings': {
                    binding_id: {
                        'api_version': request.header('X-Broker-Api-Version'),
                        'service_id': request.body.service_id,
                        'plan_id': request.body.plan_id,
                        'app_guid': request.body.app_guid,
                        'bind_resource': request.body.bind_resource,
                        'parameters': request.body.parameters
                    }
                }
            }
        },
        {
            upsert: true
        },
        function(err, result) {
            if (err) {
                response.status(500).send('Error updating database');
                return;
            }
            response.json({});
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
        var service_id = request.params.service_id;
        var binding_id = request.params.binding_id;
        console.log('Deleting service binding %s for service %s', service_id, binding_id);
        var binding = 'bindings.' + binding_id;
        this.serviceInstancesCollection.updateOne(
        {
            service_id: service_id
        },
        {
            $unset: { binding: '' }
        },
        function(err, result) {
            if (err) {
                response.status(500).send('Error updating database');
                return;
            }
            response.json({});
        });
    }

    showDashboard(request, response) {
        this.serviceInstancesCollection.find({}).toArray(function(err, serviceInstances) {
            if (err) {
                response.status(500).send('Error fetching data');
                return;
            }
            var data = {
                title: 'Service Broker Overview',
                status: 'running',
                api_version: request.header('X-Broker-Api-Version'),
                serviceInstances: serviceInstances
            };
            response.render('dashboard', data);
        });
    }

}

module.exports = ServiceBrokerInterface;
