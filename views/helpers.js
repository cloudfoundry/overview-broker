'use strict';

function help() {
    var content = document.createElement('div');
    content.innerHTML = `<br><h2>👋  Hey, I'm Overview Broker!</h2><br><br>` +
        `I am a simple service broker that you can use to test service instance and service binding workflows.<br><br>` +
        `The easiest way to use me is to register this URL with your platform:<br>` + `<code>${window.location.origin}</code><br><br>` +
        `For example, in Cloud Foundry, you can do this by running the following command (you will need to use different credentials if you deployed me yourself and <a target="_blank" href="https://github.com/mattmcneeney/overview-broker/blob/master/README.md#configuration">configured these</a>):<br><br>` +
        `<code>cf create-service-broker overview-broker admin password ${window.location.origin}</code>`;
    swal({
        content: content,
        buttons: {
            nothanks: {
                text: 'No thanks',
                className: 'swal-button--cancel'
            },
            thanks: 'Thanks!'
        }
    }).then(function(result) {
        if (result == 'nothanks') {
            window.open('https://github.com/mattmcneeney/overview-broker/issues/new', '_blank');
        }
    });
}

function cleanData() {
    swal({
        title: 'Are you sure?',
        text: 'You will not be able to recover the service instance data.',
        icon: 'warning',
        buttons: {
            cancel: {
                text: 'Cancel',
                visible: true
            },
            confirm: {
                text: 'Delete',
                visible: true,
                closeModal: false
            }
        }
    }).then(function(result) {
        if (!result) {
            return;
        }
        jQuery.post('/admin/clean', function() {
            swal({
                title: 'Completed',
                text: 'Service instance data has been deleted.',
                icon: 'success'
            }).then(function() {
                refreshPage();
            });
        }).fail(function() {
            swal({
                title: 'Oops...',
                text: 'There was a problem removing service instance data. Please try again.',
                icon: 'error'
            });
        });
    });
}

function errorModeChanged(el) {
    var errorMode = null;
    switch(el.value) {
        case 'Disabled':
            errorMode = '';
            break;
        case 'Respond to all requests with an HTTP 500':
            errorMode = 'servererror';
            break;
        case 'Respond to all requests with an HTTP 404':
            errorMode = 'notfound';
            break;
        case 'Respond to all requests with an HTTP 422':
            errorMode = 'unprocessable';
            break;
        case 'Do not respond to any request (timeout)':
            errorMode = 'timeout';
            break;
        case 'Respond with invalid JSON to any request':
            errorMode = 'invalidjson';
            break;
        case 'Fail asynchronous operations (after they have finished)':
            errorMode = 'failasync';
            break;
        default:
            console.error(`Unknown error mode detected: ${el.value}`);
            return;
    }
    jQuery.post('/admin/setErrorMode', { mode: errorMode }, function() {
        swal({
            title: 'Completed',
            text: `The error mode has been updated`,
            icon: 'success',
            buttons: false,
            timer: 1000
        });
    }).fail(function() {
        swal({
            title: 'Oops...',
            text: 'There was a problem setting the error mode. Please try again.',
            icon: 'error'
        });
    });
}

function responseModeChanged(el) {
    var responseMode = null;
    switch(el.value) {
        case 'Asynchronous responses where possible':
        responseMode = 'async';
        break;
        case 'Synchronous responses always':
        responseMode = 'sync';
        break;
        case 'Asynchronous responses always':
        responseMode = 'asyncalways';
        break;
        default:
        console.error(`Unknown response mode detected: ${el.value}`);
        return;
    }
    jQuery.post('/admin/setResponseMode', { mode: responseMode }, function() {
        swal({
            title: 'Completed',
            text: `The response mode has been updated`,
            icon: 'success',
            buttons: false,
            timer: 1000
        });
    }).fail(function() {
        swal({
            title: 'Oops...',
            text: 'There was a problem setting the response mode. Please try again.',
            icon: 'error'
        });
    });
}

function editCatalog(catalogText, prettify) {
    var prettyCatalog = prettify ? JSON.stringify(JSON.parse(catalogText), null, 2) : catalogText;
    swal({
        title: 'Edit catalog',
        className: 'edit-catalog',
        content: {
            element: 'textarea',
            attributes: {
                value: prettyCatalog
            }
        },
        buttons: {
            cancel: {
                text: 'Cancel',
                visible: true
            },
            confirm: {
                text: 'Update',
                visible: true,
                closeModal: false
            }
        }
    }).then((result) => {
        if (!result) {
            return;
        }
        let catalogData = $('.swal-modal.edit-catalog textarea').val();
        jQuery.post('/admin/updateCatalog',
        {
            catalog: catalogData
        },
        function() {
            swal({
                title: 'Yay',
                text: 'The catalog has been updated.',
                icon: 'success'
            }).then(function() {
                refreshPage();
            });
        }
    ).fail(function(error, data) {
        let catalogData = $('.swal-modal.edit-catalog textarea').val();
        swal({
            title: 'Update failed',
            text: error.responseText,
            icon: 'error'
        }).then(result => {
            editCatalog(catalogData, false);
        });
    });
});
}

function refreshPage() {
    location.reload();
}
