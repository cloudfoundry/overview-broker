let should = require('should'),
    request = require('supertest'),
    uuidv4 = require('uuid/v4'),
    app = require('./../app');

describe('Service Broker Interface', function() {

    const instanceId = uuidv4();
    const bindingId = uuidv4();
    const organizationGuid = uuidv4();
    const spaceGuid = uuidv4();
    const appGuid = uuidv4();
    const apiVersion = '2.11';

    var server = null;
    var brokerServiceId = null;
    var simplePlanId = null;
    var complexPlanId = null;
    var asyncPlanId = null;

    var brokerUsername = null;
    var brokerPassword = null;

    before(function(done) {
        app.start(function(s, sbInterface) {
            server = s;
            var serviceBroker = sbInterface.getServiceBroker();
            brokerServiceId = serviceBroker.getCatalog().services[0].id;
            brokerUsername = process.env.BROKER_USERNAME || 'admin';
            brokerPassword = process.env.BROKER_PASSWORD || 'password';
            serviceBroker.getCatalog().services[0].plans.forEach(function(plan) {
                switch (plan.name) {
                    case 'simple':
                        simplePlanId = plan.id;
                        break;
                    case 'complex':
                        complexPlanId = plan.id;
                        break;
                    case 'async':
                        asyncPlanId = plan.id;
                        break;
                    default:
                        break;
                }
            });
            done();
        });
    });

    after(function(done) {
        server.close();
        done();
    });

    describe('catalog', function() {

        it('should fetch the catalog', function(done) {
            request(server)
                .get('/v2/catalog')
                .auth(brokerUsername, brokerPassword)
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

    describe('provisioning service instances', function() {

        it('should create service instance', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {},
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

        it('should fail to create service instance without required parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
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

        it('should fail to create service instance without invalid serviceId', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: uuidv4(),
                    plan_id: simplePlanId,
                    parameters: {},
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to create service instance without invalid planId', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: uuidv4(),
                    parameters: {},
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should create asynchronously', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}?accepts_incomplete=true`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId,
                    parameters: {},
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(202)
                .then(response => {
                    request(server)
                        .get(`/v2/service_instances/${instanceId}/last_operation`)
                        .auth(brokerUsername, brokerPassword)
                        .set('X-Broker-Api-Version', apiVersion)
                        .send({
                            service_id: brokerServiceId,
                            plan_id: asyncPlanId
                         })
                        .expect(200)
                        .then(response => {
                            should.exist(response.body);
                            response.body.should.be.type('object');
                            response.body.should.have.property('state');
                            response.body.state.should.equal('in progress');

                            // The operation should finish after one second
                            setTimeout(function() {
                                request(server)
                                    .get(`/v2/service_instances/${instanceId}/last_operation`)
                                    .auth(brokerUsername, brokerPassword)
                                    .set('X-Broker-Api-Version', apiVersion)
                                    .send({
                                       service_id: brokerServiceId,
                                       plan_id: asyncPlanId
                                    })
                                    .expect(200)
                                    .then(response => {
                                        should.exist(response.body);
                                        response.body.should.be.type('object');
                                        response.body.should.have.property('state');
                                        response.body.state.should.equal('succeeded');
                                        done();
                                    });
                            }, 1000);
                        })
                        .catch(error => {
                            done(error);
                        });
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should be synchronous if accepts_incomplete=false', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}?accepts_incomplete=false`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId,
                    parameters: {},
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

    });

    describe('updating service instances', function() {

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {},
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

        it('should succeed', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {}
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail without required parameters', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
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

        it('should fail with invalid serviceId', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: uuidv4(),
                    plan_id: simplePlanId,
                    parameters: {}
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail with invalid planId', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: uuidv4(),
                    parameters: {}
                 })
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

    describe('updating service instances asynchronously', function() {

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}?accepts_incomplete=false`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId,
                    parameters: {},
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

        it('should succeed if accepts_incomplete=true', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}?accepts_incomplete=true`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId,
                    parameters: {}
                 })
                .expect(202)
                .then(response => {
                    request(server)
                        .get(`/v2/service_instances/${instanceId}/last_operation`)
                        .auth(brokerUsername, brokerPassword)
                        .set('X-Broker-Api-Version', apiVersion)
                        .send({
                            service_id: brokerServiceId,
                            plan_id: asyncPlanId
                         })
                        .expect(200)
                        .then(response => {
                            should.exist(response.body);
                            response.body.should.be.type('object');
                            response.body.should.have.property('state');
                            response.body.state.should.equal('in progress');

                            // The operation should finish after one second
                            setTimeout(function() {
                                request(server)
                                    .get(`/v2/service_instances/${instanceId}/last_operation`)
                                    .auth(brokerUsername, brokerPassword)
                                    .set('X-Broker-Api-Version', apiVersion)
                                    .send({
                                       service_id: brokerServiceId,
                                       plan_id: asyncPlanId
                                    })
                                    .expect(200)
                                    .then(response => {
                                        should.exist(response.body);
                                        response.body.should.be.type('object');
                                        response.body.should.have.property('state');
                                        response.body.state.should.equal('succeeded');
                                        done();
                                    });
                            }, 1000);
                        })
                        .catch(error => {
                            done(error);
                        });
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should revert to synchronous if accepts_incomplete=false', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}?accepts_incomplete=false`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {}
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

    describe('deprovisioning service instances', function() {

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {},
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

        it('should succeed', function(done) {
            request(server)
                .delete(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail without required parameters', function(done) {
            request(server)
                .delete(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
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

    describe('deprovisioning service instances asynchronously', function() {

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}?accepts_incomplete=false`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId,
                    parameters: {},
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

        it('should succeed if accepts_incomplete=true', function(done) {
            request(server)
                .delete(`/v2/service_instances/${instanceId}?accepts_incomplete=true`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId
                 })
                .expect(202)
                .then(response => {
                    request(server)
                        .get(`/v2/service_instances/${instanceId}/last_operation`)
                        .auth(brokerUsername, brokerPassword)
                        .set('X-Broker-Api-Version', apiVersion)
                        .send({
                            service_id: brokerServiceId,
                            plan_id: asyncPlanId
                         })
                        .expect(200)
                        .then(response => {
                            should.exist(response.body);
                            response.body.should.be.type('object');
                            response.body.should.have.property('state');
                            response.body.state.should.equal('in progress');

                            // The operation should finish after one second
                            setTimeout(function() {
                                request(server)
                                    .get(`/v2/service_instances/${instanceId}/last_operation`)
                                    .auth(brokerUsername, brokerPassword)
                                    .set('X-Broker-Api-Version', apiVersion)
                                    .send({
                                       service_id: brokerServiceId,
                                       plan_id: asyncPlanId
                                    })
                                    .expect(200)
                                    .then(response => {
                                        should.exist(response.body);
                                        response.body.should.be.type('object');
                                        response.body.should.have.property('state');
                                        response.body.state.should.equal('succeeded');
                                        done();
                                    });
                            }, 1000);
                        })
                        .catch(error => {
                            done(error);
                        });
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should revert to synchronous if accepts_incomplete=false', function(done) {
            request(server)
                .delete(`/v2/service_instances/${instanceId}?accepts_incomplete=false`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.empty();
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
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {},
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
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
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

        it('should fail to create service binding without required parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
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

        it('should fail to create service binding with invalid serviceId', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: uuidv4(),
                    plan_id: simplePlanId,
                    app_guid: appGuid,
                    bind_resource: {},
                    parameters: {}
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to create service binding with invalid planId', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: uuidv4(),
                    app_guid: appGuid,
                    bind_resource: {},
                    parameters: {}
                 })
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
                .delete(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId
                })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to delete service binding without required parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
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

        it('should fail to delete service binding with invalid serviceId', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: uuidv4(),
                    plan_id: simplePlanId
                })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to delete service binding with invalid planId', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .query({
                    service_id: brokerServiceId,
                    plan_id: uuidv4()
                })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should create asynchronously', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}?accepts_incomplete=true`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: asyncPlanId,
                    parameters: {},
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(202)
                .then(response => {
                    request(server)
                        .get(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}/last_operation`)
                        .auth(brokerUsername, brokerPassword)
                        .set('X-Broker-Api-Version', apiVersion)
                        .send({
                            service_id: brokerServiceId,
                            plan_id: asyncPlanId
                         })
                        .expect(200)
                        .then(response => {
                            should.exist(response.body);
                            response.body.should.be.type('object');
                            response.body.should.have.property('state');
                            response.body.state.should.equal('in progress');

                            // The operation should finish after one second
                            setTimeout(function() {
                                request(server)
                                    .get(`/v2/service_instances/${instanceId}/last_operation`)
                                    .auth(brokerUsername, brokerPassword)
                                    .set('X-Broker-Api-Version', apiVersion)
                                    .send({
                                       service_id: brokerServiceId,
                                       plan_id: asyncPlanId
                                    })
                                    .expect(200)
                                    .then(response => {
                                        should.exist(response.body);
                                        response.body.should.be.type('object');
                                        response.body.should.have.property('state');
                                        response.body.state.should.equal('succeeded');
                                        done();
                                    });
                            }, 1000);
                        })
                        .catch(error => {
                            done(error);
                        });
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should not create binding asynchronously if accepts_incomplete=false', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}?accepts_incomplete=false`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    app_guid: appGuid,
                    bind_resource: {},
                    parameters: {},
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

    });

    describe('dashboard', function() {

        it('should show dashboard', function(done) {
            request(server)
                .get('/dashboard')
                .expect(200, done);
        });

    });

    describe('service instance paramter validation', function() {

        let validParameters = { name: 'special-broker' };
        let invalidParameters = { foo: 'bar' };

        it('should create service instance with valid parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    parameters: validParameters,
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

        it('should fail to create service instance with invalid parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    parameters: invalidParameters,
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to create service instance with no parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should update service instance with valid parameters', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    parameters: validParameters
                 })
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.be.empty();
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to update service instance with invalid parameters', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    parameters: invalidParameters
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to update service instance with no parameters', function(done) {
            request(server)
                .patch(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId
                 })
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

    describe('service binding parameter validation', function() {

        let validParameters = { name: 'special-broker' };
        let invalidParameters = { foo: 'bar' };

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    parameters: {},
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {},
                    parameters: validParameters
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

        it('should create service binding with valid parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    app_guid: appGuid,
                    bind_resource: {},
                    parameters: validParameters
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

        it('should fail to create service binding with invalid parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    app_guid: appGuid,
                    bind_resource: {},
                    parameters: invalidParameters
                 })
                .expect(400)
                .then(response => {
                    should.exist(response.body);
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail to create service binding with no parameters', function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: complexPlanId,
                    app_guid: appGuid,
                    bind_resource: {}
                 })
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

    describe('fetching service instances', function() {

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: { foo: 'bar' },
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

        it('should succeed', function(done) {
            request(server)
                .get(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.have.property('dashboard_url');
                    response.body.should.have.property('service_id');
                    response.body.should.have.property('plan_id');
                    response.body.should.have.property('parameters');
                    response.body.parameters.should.have.property('foo');
                    response.body.parameters.foo.should.equal('bar');
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

        it('should fail', function(done) {
            request(server)
                .get(`/v2/service_instances/${uuidv4()}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(404)
                .then(response => {
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

    describe('fetching service bindings', function() {

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: {},
                    organization_guid: organizationGuid,
                    space_guid: spaceGuid,
                    context: {}
                 })
                .expect(200)
                .then(response => {
                    request(server)
                        .put(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                        .auth(brokerUsername, brokerPassword)
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
                            done();
                        })
                        .catch(error => {
                            done(error);
                        });
                });
        });

        it('should succeed', function(done) {
            request(server)
                .get(`/v2/service_instances/${instanceId}/service_bindings/${bindingId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
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

        it('should fail', function(done) {
            request(server)
                .get(`/v2/service_instances/${instanceId}/service_bindings/${uuidv4()}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(404)
                .then(response => {
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

    describe('listing service instances', function() {

        beforeEach(function(done) {
            request(server)
                .put(`/v2/service_instances/${instanceId}`)
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .send({
                    service_id: brokerServiceId,
                    plan_id: simplePlanId,
                    parameters: { foo: 'bar' },
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

        it('should succeed', function(done) {
            request(server)
                .get('/v2/service_instances')
                .auth(brokerUsername, brokerPassword)
                .set('X-Broker-Api-Version', apiVersion)
                .expect(200)
                .then(response => {
                    should.exist(response.body);
                    response.body.should.have.property(instanceId);
                    response.body[instanceId].should.have.property('dashboard_url');
                    response.body[instanceId].should.have.property('metrics_url');
                    done();
                })
                .catch(error => {
                    done(error);
                });
        });

    });

    describe('clean', function() {

        it('should succeed', function(done) {
            request(server)
                .post('/admin/clean')
                .expect(200)
                .then(response => {
                    done();
                })
                .catch(error => {
                    done(error)
                });
        });
    });

});
