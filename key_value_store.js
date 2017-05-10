var kvs = require('keyvalue-xyz');

class KeyValueStore {

    constructor() {
        /* Using the same key for every deployed broker is very nasty, but
         * we have no other way of holding on to the token, and you can't use
         * the same token for different keys. Fun fun fun. The least we can
         * do is use a different hardcoded token for each environment.
         *
         * To generate a new token:
         *    $ curl -X POST https://api.keyvalue.xyz/new/overview_broker
         */
        this.token = null;
        switch (process.env.NODE_ENV) {
            case 'testing':
                this.token = 'bc10a56f';
                break;
            case 'development':
                this.token = '7f521549';
                break;
            case 'production':
                this.token = 'f5e9213c';
                break;
            default:
                this.token = 'aab90650';
                break;
        }
    }

    loadData(key, callback) {
        kvs.getJSONForKey(this.token, 'overview_broker', function(error, value) {
            if (error) {
                console.error(error);
                callback(null);
                return;
            }
            if (key) {
                callback(value[key]);
                return;
            }
            callback(value);
        });
    }

    saveData(key, value, callback) {
        var self = this;
        // Load data first in case it has been changed by another broker
        this.loadData(null, function(data) {
            if (!data) {
                callback(false);
                return;
            }
            data[key] = value;
            kvs.setJSONForKey(self.token, 'overview_broker', data, function(error) {
                if (error) {
                    console.error(error);
                    callback(false);
                    return;
                }
                callback(true);
            });
        });
    }

}

module.exports = KeyValueStore;
