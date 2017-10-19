var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    expressValidator = require('express-validator'),
    basicAuth = require('express-basic-auth'),
    morgan = require('morgan'),
    ServiceBrokerInterface = require('./service_broker_interface'),
    serviceBrokerInterface = null;

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(expressValidator());
app.use(morgan('combined'));

app.set('view engine', 'pug');

function start(callback) {
    serviceBrokerInterface = new ServiceBrokerInterface();
    app.get('/', function(req, res) {
        res.redirect(303, '/dashboard');
    });

    app.use(basicAuth({
        users: { 'admin': 'password' }
    }));

    app.all('*', function(req, res, next) {
        serviceBrokerInterface.checkRequest(req, res, next);
    });

    app.get('/v2/catalog', function(req, res) {
        serviceBrokerInterface.getCatalog(req, res);
    });
    app.put('/v2/service_instances/:instance_id', function(req, res) {
        serviceBrokerInterface.createServiceInstance(req, res);
    });
    app.patch('/v2/service_instances/:instance_id', function(req, res) {
        serviceBrokerInterface.updateServiceInstance(req, res);
    });
    app.delete('/v2/service_instances/:instance_id', function(req, res) {
        serviceBrokerInterface.deleteServiceInstance(req, res);
    });
    app.put('/v2/service_instances/:instance_id/service_bindings/:binding_id', function(req, res) {
        serviceBrokerInterface.createServiceBinding(req, res);
    });
    app.delete('/v2/service_instances/:instance_id/service_bindings/:binding_id', function(req, res) {
        serviceBrokerInterface.deleteServiceBinding(req, res);
    });
    app.get('/v2/service_instances/:instance_id/last_operation', function(req, res) {
        serviceBrokerInterface.getLastOperation(req, res);
    });
    app.get('/dashboard', function(req, res) {
        serviceBrokerInterface.showDashboard(req, res);
    });
    app.post('/admin/clean', function(req, res) {
        serviceBrokerInterface.clean(req, res);
    });
    app.post('/admin/updateCatalog', function(req, res) {
        serviceBrokerInterface.updateCatalog(req, res);
    });
    app.use('/images', express.static('images'));

    var port = process.env.PORT || 3000;
    var server = app.listen(port, function() {
        console.log('Overview broker running on port ' + server.address().port);

        // Initialise data
        serviceBrokerInterface.initData(function(success) {
            if (!success) {
                console.error('Error initialising data');
                process.exit(1);
                return;
            }
            callback(server, serviceBrokerInterface);
        });
    });
}

exports.start = start;
