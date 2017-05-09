var should = require('should'),
    Guid = require('guid'),
    KeyValueStore = require('./../key_value_store');

describe('Key Value Store', function() {

    var keyValueStore = new KeyValueStore();
    var key = process.env.NODE_ENV;

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
