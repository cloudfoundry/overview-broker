var request = require('request');

class KeyValueStore {

    constructor() {
        this.baseUrl = 'https://api.keyvalue.xyz';
        this.storageUrl = null;
    }

    createStore(keyName, callback) {
        var self = this;
        request({
            url: this.baseUrl + '/new/' + keyName,
            method: 'POST'
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                self.storageUrl = response.body;
                console.log('Key value store created (%s)', keyName);
                callback(true);
            }
            else {
                console.error(error);
                callback(false);
            }
        });
    }

    loadData(callback) {
        if (!this.storageUrl) {
            console.error('Missing key value store URL');
            return;
        }
        request({
            url: this.storageUrl,
            method: 'GET'
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                callback(response.body);
            }
            else {
                console.error(error);
                callback(null);
            }
        });
    }

    saveData(data, callback) {
        if (!this.storageUrl) {
            console.error('Missing key value store URL');
            return;
        }
        request({
            url: this.storageUrl,
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
    }

}

module.exports = KeyValueStore;
