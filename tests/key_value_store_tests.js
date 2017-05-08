var should = require('should'),
    Guid = require('guid'),
    KeyValueStore = require('./../key_value_store');

describe('Key Value Store', function() {

    var keyValueStore = new KeyValueStore();

    before(function(done) {
        keyValueStore.createStore(Guid.create(), function(success) {
            if (!success) {
                done('Error creating key value store');
                return;
            }
            done();
        });
    });

    it('should save data', function(done) {
        keyValueStore.saveData({ foo: 'bar' }, function(success) {
            if (!success) {
                done('Error saving data');
                return;
            }
            done();
        });
    });

    it('should load data', function(done) {
        keyValueStore.loadData(function(data) {
            if (!data) {
                done('Error loading data');
                return;
            }
            done();
        });
    });

});
