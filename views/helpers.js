'use strict';

function extractServiceData(serviceData) {
   var serviceDataToDisplay = JSON.parse(JSON.stringify(serviceData))
   JSON.stringify(serviceDataToDisplay)
   delete serviceDataToDisplay['created']
   delete serviceDataToDisplay['last_updated']
   return serviceDataToDisplay;
}

function updateCatalog() {
   jQuery.post('/admin/updateCatalog',
      {
         catalog: $('#catalog textarea').val()
      },
      function() {
         swal({
            title: 'Yay',
            text: 'The catalog has been updated.',
            type: 'success'
         },
         function() {
            refreshPage()
         });
      }
   ).fail(function() {
      swal({
         title: 'Oops...',
         text: 'There is a problem with the catalog. Please check it and try again.',
         type: 'error'
      });
   });
}

function cleanData() {
   swal({
      title: 'Are you sure?',
      text: 'You will not be able to recover the service instance data.',
      type: 'warning',
      showCancelButton: true,
      closeOnConfirm: false
   },
   function() {
      jQuery.post('/admin/clean', function() {
         swal({
            title: 'Completed',
            text: 'Service instance data has been deleted.',
            type: 'success'
         },
         function() {
            refreshPage();
         });
      }).fail(function() {
         swal({
            title: 'Oops...',
            text: 'There was a problem removing service instance data. Please try again.',
            type: 'error'
         });
      });
   });
}

function refreshPage() {
   location.reload();
}
