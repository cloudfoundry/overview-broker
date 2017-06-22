var fs = require('fs'),
    cfenv = require('cfenv'),
    validate = require ('jsonschema').validate;

class ServiceBroker {

    constructor() {
        this.catalog = {
            services: [
                {
                    name: 'overview-broker',
                    description: 'Provides an overview of any service instances and bindings that have been created by a platform.',
                    id: '27068e11-6853-0892-fc7f-13fe7a8dc5bd',
                    tags: [ 'overview-broker' ],
                    bindable: true,
                    plan_updateable: true,
                    plans: this.generatePlans()
                }
            ]
        };
        this.storageKey = process.env.KV_KEY_NAME;
        this.dashboardUrl = cfenv.getAppEnv().url + '/dashboard';
        console.log(
            'Broker created\n   Name: %s\n   ID: %s\n   Persistence: %s',
            this.catalog.services[0].name,
            this.catalog.services[0].id,
            (process.env.ENABLE_PERSISTENCE ? 'Enabled' : 'Disabled')
        );
    }

    getCatalog() {
        return this.catalog;
    }

    getDashboardUrl() {
        return this.dashboardUrl;
    }

    getService(serviceId) {
        return this.catalog.services.find(function(service) {
            return service.id == serviceId;
        });
    }

    getPlanForService(serviceId, planId) {
        var service = this.getService(serviceId);
        if (!service) {
            return null;
        }
        return service.plans.find(function(plan) {
            return plan.id == planId;
        });
    }

    validateParameters(schema, parameters) {
        var result = validate(parameters, schema);
        if (!result.valid) {
            console.log('Validation failed: ' + result.errors.toString());
            return result.errors.toString();
        }
        else {
            console.log('Validation succeeded');
            return null;
        }
    }

    generatePlans() {
        var plans = [];

        // Add a very simple plan
        plans.push({
            id: 'b2bbb243-372d-570c-28d6-f708a1a5d83b',
            name: 'simple',
            description: 'A very simple plan.',
            free: true
        });

        // Add a complex plan with a schema
        var complexPlanSchema = {
            $schema: 'http://json-schema.org/draft-04/schema#',
            additionalProperties: false,
            type: 'object',
            properties: {
                rainbow: {
                    type: 'boolean',
                    default: false
                },
                name: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 30
                },
                config: {
                    type: 'object',
                    properties: {
                        'url': {
                            type: 'string'
                        },
                        'port': {
                            type: 'integer'
                        }
                    }
                }
            },
            required: [ 'name' ]
        };
        plans.push({
            id: 'b3c9e1fb-3e37-fcb8-be0a-df68d95c40b0',
            name: 'complex',
            description: 'A more complicated plan.',
            free: true,
            schemas: {
                service_instance: {
                    create: {
                        parameters: complexPlanSchema
                    },
                    update: {
                        parameters: complexPlanSchema
                    }
                },
                service_binding: {
                    create: {
                        parameters: complexPlanSchema
                    }
                }
            }
        });

        // Load example schemas and generate a plan for each
        var exampleSchemas = fs.readdirSync('example_schemas');
        for (var i = 0; i < exampleSchemas.length; i++) {
            var name = exampleSchemas[i].split('.json')[0];
            var schema = require('./example_schemas/' + name);
            plans.push({
                id: name,
                name: name,
                description: name.replace(/-/g, ' '),
                free: true,
                schemas: {
                    service_instance: {
                        create: {
                            parameters: schema
                        }
                    }
                }
            });
        }

        // All plans generated
        return plans;
    }

}

module.exports = ServiceBroker;
