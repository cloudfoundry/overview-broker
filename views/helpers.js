'use strict';

function cleanData() {
    swal({
        title: 'Are you sure?',
        text: 'You will not be able to recover the service instance data.',
        icon: 'warning',
        showCancelButton: true,
        closeOnConfirm: false
    },
    function() {
        jQuery.post('/admin/clean', function() {
            swal({
                title: 'Completed',
                text: 'Service instance data has been deleted.',
                icon: 'success'
            },
            function() {
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
        case 'Do not respond to any request (timeout)':
            errorMode = 'timeout';
            break;
        case 'Respond with invalid JSON to any request':
            errorMode = 'invalidjson';
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
