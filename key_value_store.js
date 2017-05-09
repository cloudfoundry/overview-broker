var request = require('request');

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
        var token = null;
        switch (process.env.NODE_ENV) {
            case 'testing':
                token = 'bc10a56f';
                break;
            case 'development':
                token = '7f521549';
                break;
            case 'production':
                token = 'f5e9213c';
                break;
            default:
                token = 'aab90650';
                break;
        }

        this.baseUrl = 'https://api.keyvalue.xyz/' + token + '/overview_broker';
    }

    loadData(key, callback) {
        if (!this.baseUrl) {
            console.error('Missing key value store URL');
            callback(false);
            return;
        }
        request({
            url: this.baseUrl,
            method: 'GET'
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                if (response.body == '\n') {
                    callback({});
                    return;
                }
                var data = JSON.parse(response.body);
                if (key) {
                    callback(data[key]);
                    return;
                }
                callback(data);
            }
            else {
                console.error(error);
                callback(null);
            }
        });
    }

    saveData(key, value, callback) {
        var self = this;
        if (!this.baseUrl) {
            console.error('Missing key value store URL');
            callback(false);
            return;
        }
        // Load data first in case it has been changed by another broker
        this.loadData(null, function(data) {
            if (!data) {
                callback(false);
                return;
            }
            data[key] = value;
            request({
                url: self.baseUrl,
                method: 'POST',
                json: true,
                body: data
            }, function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    callback(true);
                }
                else {
                    console.error(error);
                    callback(false);
                }
            });
        });
    }

}

module.exports = KeyValueStore;
