var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    expressValidator = require('express-validator'),
    ServiceBrokerInterface = require('./service_broker_interface');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(expressValidator());

app.set('view engine', 'pug');

var serviceBrokerInterface = new ServiceBrokerInterface();

app.get('/v2/catalog', function(req, res) {
    serviceBrokerInterface.getCatalog(req, res);
});
app.put('/v2/service_instances/:service_id', function(req, res) {
    serviceBrokerInterface.createServiceInstance(req, res);
});
app.patch('/v2/service_instances/:service_id', function(req, res) {
    serviceBrokerInterface.updateServiceInstance(req, res);
});
app.delete('/v2/service_instances/:service_id', function(req, res) {
    serviceBrokerInterface.deleteServiceInstance(req, res);
});
app.put('/v2/service_instances/:service_id/service_bindings/:binding_id', function(req, res) {
    serviceBrokerInterface.createServiceBinding(req, res);
});
app.delete('/v2/service_instances/:service_id/service_bindings/:binding_id', function(req, res) {
    serviceBrokerInterface.deleteServiceBinding(req, res);
});
app.get('/dashboard', function(req, res) {
    serviceBrokerInterface.showDashboard(req, res);
});

function setup(callback) {
    serviceBrokerInterface.setupDatabase(function(success) {
        if (!success) {
            callback('Error setting up database');
            return;
        }
        var port = process.env.PORT || 3000;
        var server = app.listen(port, function() {
            console.log('Overview broker running on port ' + server.address().port);
            callback();
        });
        exports.server = server;
    });
}

function cleanup(callback) {
    // Protection!
    if (process.env.NODE_ENV != 'testing') {
        console.error('Did you really mean to cleanup the database in %s ?' % process.env.NODE_ENV);
        callback('No way');
        return;
    }
    serviceBrokerInterface.cleanupDatabase(function(success) {
        if (!success) {
            callback('Error cleaning up database');
            return;
        }
        callback();
    });
}

exports.setup = setup;
exports.cleanup = cleanup;
