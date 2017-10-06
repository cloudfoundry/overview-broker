var fs = require('fs'),
    cfenv = require('cfenv'),
    sha256 = require('sha256'),
    validate = require ('jsonschema').validate;

class ServiceBroker {

    constructor() {
        this.catalog = {
            services: [
                {
                    name: cfenv.getAppEnv().name,
                    description: 'Provides an overview of any service instances and bindings that have been created by a platform.',
                    id: sha256(cfenv.getAppEnv().name).substring(0, 32),
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

    setCatalog(data) {
        try {
            var catalogData = JSON.parse(data);
            this.catalog = catalogData;
            return null;
        }
        catch (e) {
            return e.toString();
        }
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
            return result.errors.toString();
        }
        else {
            return null;
        }
    }

    generatePlans() {
        var plans = [];

        // Add a very simple plan
        plans.push({
            name: 'simple',
            description: 'A very simple plan.',
            free: true
        });

        // Add a plan to test async operations
        plans.push({
            name: 'async',
            description: 'Use me to test asynchronous operations',
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
                    default: false,
                    description: 'Follow the rainbow'
                },
                name: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 30,
                    default: 'This is a default string',
                    description: 'The name of the broker'
                },
                color: {
                    type: 'string',
                    enum: [ 'red', 'amber', 'green' ],
                    default: 'green',
                    description: 'Your favourite color'
                },
                config: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string'
                        },
                        port: {
                            type: 'integer'
                        }
                    }
                }
            },
            required: [ 'name' ]
        };
        plans.push({
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
        if (process.env.DISABLE_EXAMPLE_SCHEMAS === undefined) {
            var exampleSchemas = fs.readdirSync('example_schemas');
            for (var i = 0; i < exampleSchemas.length; i++) {
                var name = exampleSchemas[i].split('.json')[0];
                var schema = require('./example_schemas/' + name);
                plans.push({
                    name: name,
                    description: name.replace(/-/g, ' '),
                    free: true,
                    schemas: {
                        service_instance: {
                            create: {
                                parameters: schema
                            },
                            update: {
                                parameters: schema
                            }
                        },
                        service_binding: {
                            create: {
                                parameters: schema
                            }
                        }
                    }
                });
            }
        }

        // Add an id to each plan
        plans.forEach(function(plan) {
            plan.id = sha256(cfenv.getAppEnv().name + '-' + plan.name).substring(0, 32);
        });

        // All plans generated
        return plans;
    }

}

module.exports = ServiceBroker;
