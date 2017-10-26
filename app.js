var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    expressValidator = require('express-validator'),
    basicAuth = require('express-basic-auth'),
    morgan = require('morgan'),
    Logger = require('./logger'),
    ServiceBrokerInterface = require('./service_broker_interface'),
    serviceBrokerInterface = null;

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(expressValidator());

if (process.env.NODE_ENV != 'testing') {
    app.use(morgan('tiny'));
}

app.set('view engine', 'pug');

function start(callback) {
    logger = new Logger();
    serviceBrokerInterface = new ServiceBrokerInterface();

    /* Unauthenticated routes */
    app.get('/', function(request, response) {
        response.redirect(303, '/dashboard');
    });
    app.get('/dashboard', function(request, response) {
        serviceBrokerInterface.showDashboard(request, response);
    });
    app.post('/admin/clean', function(request, response) {
        serviceBrokerInterface.clean(request, response);
    });
    app.post('/admin/updateCatalog', function(request, response) {
        serviceBrokerInterface.updateCatalog(request, response);
    });
    app.use('/images', express.static('images'));

    /* Check Basic Auth credentials */
    app.use(basicAuth({
        users: { 'admin': 'password' }
    }));

    /* Authenticated routes */
    app.all('*', function(request, response, next) {
        serviceBrokerInterface.checkRequest(request, response, next);
    });
    app.get('/v2/catalog', function(request, response) {
        serviceBrokerInterface.getCatalog(request, response);
    });
    app.put('/v2/service_instances/:instance_id', function(request, response) {
        serviceBrokerInterface.createServiceInstance(request, response);
    });
    app.patch('/v2/service_instances/:instance_id', function(request, response) {
        serviceBrokerInterface.updateServiceInstance(request, response);
    });
    app.delete('/v2/service_instances/:instance_id', function(request, response) {
        serviceBrokerInterface.deleteServiceInstance(request, response);
    });
    app.put('/v2/service_instances/:instance_id/service_bindings/:binding_id', function(request, response) {
        serviceBrokerInterface.createServiceBinding(request, response);
    });
    app.delete('/v2/service_instances/:instance_id/service_bindings/:binding_id', function(request, response) {
        serviceBrokerInterface.deleteServiceBinding(request, response);
    });
    app.get('/v2/service_instances/:instance_id/last_operation', function(request, response) {
        serviceBrokerInterface.getLastOperation(request, response);
    });

    var port = process.env.PORT || 3000;
    var server = app.listen(port, function() {
        logger.debug(`Overview broker running on port ${server.address().port}`);
        callback(server, serviceBrokerInterface);
    });
}

exports.start = start;
