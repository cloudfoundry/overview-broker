var should = require('should'),
    request = require('supertest'),
    Guid = require('guid'),
    kvs = require('keyvalue-xyz'),
    app = require('./../app');

describe('Persistence', function() {

    const instanceId = Guid.create().value;
    const bindingId = Guid.create().value;
    const organizationGuid = Guid.create().value;
    const spaceGuid = Guid.create().value;
    const appGuid = Guid.create().value;
    const apiVersion = '2.11';

    var server = null;
    var brokerServiceId = null;
    var simplePlanId = null;
    var complexPlanId = null;

    before(function(done) {
        // Set required env vars
        process.env.ENABLE_PERSISTENCE = true;
        process.env.KV_KEY_NAME = 'testing';
        kvs.createToken(process.env.KV_KEY_NAME, function(error, token) {
            if (error) {
                done(error);
                return;
            }
            process.env.KV_TOKEN = token;
            app.start(function(s, sbInterface) {
                server = s;
                var serviceBroker = sbInterface.getServiceBroker();
                brokerServiceId = serviceBroker.getCatalog().services[0].id;
                serviceBroker.getCatalog().services[0].plans.forEach(function(plan) {
                    switch (plan.name) {
                        case 'simple':
                            simplePlanId = plan.id;
                            break;
                        case 'complex':
                            complexPlanId = plan.id;
                            break;
                        default:
                            break;
                    }
                });
                done();
            });
        });
    });

    after(function(done) {
        server.close();
        delete process.env.ENABLE_PERSISTENCE;
        delete process.env.KV_KEY_NAME;
        delete process.env.TOKEN;
        done();
    });

    describe('service instances', function() {

        it('should create service instance', function(done) {
            request(server)
                .put('/v2/service_instances/' + instanceId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {},
                    accepts_incomplete: true,
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.type('object');
                    response.body.should.have.property('dashboard_url');
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should update service instance', function(done) {
            request(server)
                .patch('/v2/service_instances/' + instanceId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {}
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    (response.body).should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should delete service instance', function(done) {
            request(server)
                .delete('/v2/service_instances/' + instanceId)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    (response.body).should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

    describe('service bindings', function() {

        beforeEach(function(done) {
            request(server)
                .put('/v2/service_instances/' + instanceId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {},
                    accepts_incomplete: true,
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should create service binding', function(done) {
            request(server)
                .put('/v2/service_instances/' + instanceId + '/service_bindings/' + bindingId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    app_guid: appGuid,
                    bind_resource: {},
                    parameters: {}
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.type('object');
                    response.body.should.have.property('credentials');
                    response.body.credentials.should.have.property('username');
                    response.body.credentials.should.have.property('password');
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should delete service binding', function(done) {
            request(server)
                .delete('/v2/service_instances/' + instanceId + '/service_bindings/' + bindingId)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId
                })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    (response.body).should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

});
