var should = require('should'),
    request = require('supertest'),
    Guid = require('guid'),
    kvs = require('keyvalue-xyz'),
    app = require('./../app');

describe('Service Broker API', function() {

    const serviceId = Guid.create();
    const planId = Guid.create();
    const bindingId = Guid.create();
    const organizationGuid = Guid.create();
    const spaceGuid = Guid.create();
    const appGuid = Guid.create();
    const apiVersion = '2.11';

    var server = null;

    before(function(done) {
        // Set required env vars
        process.env.KV_KEY_NAME = 'testing';
        console.log('creating token');
        kvs.createToken(process.env.KV_KEY_NAME, function(error, token) {
            if (error) {
                done(error);
                return;
            }
            process.env.KV_TOKEN = token;
            app.start(function(s) {
                server = s;
                done();
            });
        });
    });

    describe('catalog', function() {

        it('should fetch the catalog', function(done) {
            request(server)
                .get('/v2/catalog')
                .set('X-Broker-Api-Version', apiVersion)
                .expect(200)
                .then(response => {
                    should.exist(response.body.services);
                    var services = response.body.services;
                    services.should.have.length(1);
                    should.exist(services[0].name);
                    should.exist(services[0].description);
                    should.exist(services[0].id);
                    should.exist(services[0].tags);
                    should.exist(services[0].bindable);
                    should.exist(services[0].plan_updateable);
                    should.exist(services[0].plans);
                    var plans = services[0].plans;
                    plans.should.have.length(1);
                    should.exist(plans[0].id);
                    should.exist(plans[0].name);
                    should.exist(plans[0].description);
                    should.exist(plans[0].free);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

    describe('service instances', function() {

        it('should create service instance', function(done) {
            request(server)
                .put('/v2/service_instances/' + serviceId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: serviceId,
                    plan_id: planId,
                    parameters: {},
                    accepts_incomplete: true,
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
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

        it('should fail to create service instance without required parameters', function(done) {
            request(server)
                .put('/v2/service_instances/' + serviceId)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should update service instance', function(done) {
            request(server)
                .patch('/v2/service_instances/' + serviceId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: serviceId,
                    plan_id: planId,
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

        it('should fail to update service instance without required parameters', function(done) {
            request(server)
                .patch('/v2/service_instances/' + serviceId)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should delete service instance', function(done) {
            request(server)
                .delete('/v2/service_instances/' + serviceId)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: serviceId,
                    plan_id: planId
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

        it('should fail to delete service instance without required parameters', function(done) {
            request(server)
                .delete('/v2/service_instances/' + serviceId)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(400)
                .then(response => {
                    should.exist(response.body);
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
                .put('/v2/service_instances/' + serviceId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: serviceId,
                    plan_id: planId,
                    parameters: {},
                    accepts_incomplete: true,
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
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

        it('should create service binding', function(done) {
            request(server)
                .put('/v2/service_instances/' + serviceId + '/service_bindings/' + bindingId)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: serviceId,
                    plan_id: planId,
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

        it('should fail to create service binding without required parameters', function(done) {
            request(server)
                .put('/v2/service_instances/' + serviceId + '/service_bindings/' + bindingId)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should delete service binding', function(done) {
            request(server)
                .delete('/v2/service_instances/' + serviceId + '/service_bindings/' + bindingId)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: serviceId,
                    binding_id: bindingId
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

        it('should fail to delete service binding without required parameters', function(done) {
            request(server)
                .put('/v2/service_instances/' + serviceId + '/service_bindings/' + bindingId)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

    describe('dashboard', function() {

        it('should show dashboard', function(done) {
            request(server)
                .get('/dashboard')
                .expect(200, done);
        });

    });

});
