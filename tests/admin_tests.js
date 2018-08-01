let should = require('should'),
    request = require('supertest'),
    app = require('./../app');

describe('Admin', function() {

    var server = null;
    var catalog = null;

    before(function(done) {
        app.start(function(s, sbInterface) {
            let serviceBroker = sbInterface.getServiceBroker();
            catalog = serviceBroker.getCatalog();
            server = s;
            done();
        });
    });

    after(function(done) {
        server.close(() => {
            done();
        });
    });

    describe('cleaning', function() {

        it('should succeed', function(done) {
            request(server)
                .post('/admin/clean')
                .expect(200)
                .then(response => {
                    done();
                });
        });

    });

    describe('update catalog', function() {

        it('should succeed', function(done) {
            request(server)
                .post('/admin/updateCatalog')
                .send({ catalog: JSON.stringify(catalog) })
                .expect(200)
                .then(response => {
                    done();
                });
        });

    });

    describe('error mode', function() {

        it('should set to disabled', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: '' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

        it('should set to timeout', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: 'timeout' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

        it('should set to servererror', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: 'servererror' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

        it('should set to notfound', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: 'notfound' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

        it('should set to gone', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: 'gone' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

        it('should set to unprocessable', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: 'unprocessable' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

        it('should set to invalidjson', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: 'invalidjson' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

        it('should set to failasync', function(done) {
            request(server)
                .post('/admin/setErrorMode')
                .send({ mode: 'failasync' })
                .expect(200)
                .then(response => {
                    done();
                });
        });

    });

});
