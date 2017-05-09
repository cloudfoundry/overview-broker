var Guid = require('guid'),
    cfenv = require('cfenv');

class ServiceBroker {

    constructor() {
        var space = cfenv.getAppEnv().app.space_name || 'test';
        this.name = 'overview-broker-' + space;
        this.description = 'Provides an overview of any service instances and bindings that have been created by a platform.';
        this.id = Guid.create();
        this.bindable = true;
        this.tags = [ 'my-tag' ];
        this.plans = [
            {
                id: Guid.create(),
                name: 'default',
                description: 'One plan to rule them all.',
                free: true
            }
        ];
        this.storageKey = cfenv.getAppEnv().app.space_id || 'test';
        console.log('Broker created (name: %s, id: %s)', this.name, this.id);
    }

    getName() {
        return this.name;
    }

    getDescription() {
        return this.description;
    }

    getID() {
        return this.id;
    }

    getBindable() {
        return this.bindable;
    }

    getTags() {
        return this.tags;
    }

    getPlans() {
        return this.plans;
    }

    getStorageKey() {
        return this.storageKey;
    }

}

module.exports = ServiceBroker;
