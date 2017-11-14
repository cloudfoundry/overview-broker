'use strict';

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
         });
      }
   ).fail(function(error, data) {
      console.log(error);
      swal({
         title: 'Oops...',
         text: `There is a problem with the catalog. Please check it and try again.\n\n${error.responseText}`,
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

function syntaxHighlight(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}
