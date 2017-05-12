var kvs = require('keyvalue-xyz'),
    CronJob = require('cron').CronJob;

class KeyValueStore {

    constructor() {
        /*
         * Using the same key for every deployed broker is very nasty, but
         * we have no other way of holding on to the token, and you can't use
         * the same token for different keys. Fun fun fun. The least we can
         * do is use a different hardcoded token for each environment.
         *
         * To generate a new token:
         *    $ curl -X POST https://api.keyvalue.xyz/new/overview_broker
         */
        this.token = null;
        this.key = 'overview_broker';
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

        /*
         * keyvalue.xyz keys are removed after 7 days of inactivity, so let's make sure we
         * update our data at least once a day so it hangs around forever.
         *    https://github.com/kvaas/docs/blob/master/Limits.md
         */
        new CronJob('0 0 * * *', function() {
            this.updateData(function(error) {});
        });
    }

    loadData(key, callback) {
        kvs.getJSONForKey(this.token, this.key, function(error, value) {
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
            kvs.setJSONForKey(self.token, self.key, data, function(error) {
                if (error) {
                    console.error(error);
                    callback(false);
                    return;
                }
                callback(true);
            });
        });
    }

    updateData(callback) {
        console.log('Updating data to prevent deletion after inactivity');
        var self = this;
        kvs.getJSONForKey(this.token, this.key, function(error, value) {
            if (error) {
                console.error('Error loading data to prevent deletion: ' + error);
                callback(error);
                return;
            }
            kvs.setJSONForKey(self.token, self.key, value, function(error) {
                if (error) {
                    console.error('Error saving data to prevent deletion: ' + error);
                    callback(error);
                    return;
                }
                console.log('Data updated successfully');
                callback(null);
            });
        });
    }

}

module.exports = KeyValueStore;
