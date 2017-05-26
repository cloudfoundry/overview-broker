var should = require('should'),
    Guid = require('guid'),
    kvs = require('keyvalue-xyz'),
    KeyValueStore = require('./../key_value_store');

describe.skip('Key Value Store', function() {

    var keyValueStore = null;
    var key = 'testing';

    before(function(done) {
        // Generate a new token for testing
        kvs.createToken(key, function(error, token) {
            if (error) {
                done(error);
                return;
            }
            keyValueStore = new KeyValueStore(token, key);
            done();
        });
    });

    // Cleanup before each test
    beforeEach(function(done) {
        keyValueStore.saveData(key, {}, function(success) {
            if (!success) {
                done('Failed to cleanup');
                return;
            }
            done();
        });
    });

    it('should save data', function(done) {
        keyValueStore.saveData(key, { foo: 'bar' }, function(success) {
            if (!success) {
                done('Error saving data');
                return;
            }
            done();
        });
    });

    it('should load saved data', function(done) {
        keyValueStore.saveData(key, { foo: 'bar' }, function(success) {
            if (!success) {
                done('Error saving data');
                return;
            }
            keyValueStore.loadData(key, function(data) {
                if (!data) {
                    done('Error loading data');
                    return;
                }
                (data.foo).should.be.equal('bar');
                done();
            });
        });
    });

    it('should update data', function(done) {
        keyValueStore.updateData(function(error) {
            done(error);
        });
    });

    // Cleanup after each test
    afterEach(function(done) {
        keyValueStore.saveData(key, {}, function(success) {
            if (!success) {
                done('Failed to cleanup');
                return;
            }
            done();
        });
    });

});
