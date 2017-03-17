/**
 * Created by rgeorgi on 3/16/17.
 */

function spanSelect(obj) {
    $(obj).closest('tr');
}

function getTag(trObj) {
    return $(trObj).find('.tag-select').val().toLowerCase();
}

function getSpan(trObj) {
    return $(trObj).find('.span-select').val();
}

function getLineNo(trObj) {
    return parseInt($(trObj).find('.lineno').attr('lineno'));
}

function isNewSpan(trObj) {
    return getSpan(trObj) == 'new-span';
}

function toggleSpan(trObj) {
    var isO = getTag(trObj) == 'o';
    if (isO) {
        $(trObj).removeClass('new-span');
    } else if (isNewSpan(trObj)) {
        $(trObj).addClass('new-span');
    } else {
        $(trObj).removeClass('new-span');
    }
}

function spanSelect(obj) {
    var trObj = $(obj).closest('tr');
    toggleSpan(trObj);
}

function tagSelect(obj) {
    var tagVal = $(obj).val();
    var trObj = $(obj).closest('tr');
    trObj.removeClass('tag-noisy tag-g tag-l tag-t tag-m tag-o');
    var newClass = 'tag-' + tagVal.toLowerCase();
    trObj.addClass(newClass);

    /* Toggle the visibility of the span selector on
        Whether the tag is O or not. */
    var spanSel = trObj.find('.span-select');
    if (tagVal == 'O') {
        spanSel.css('display', 'none');
        trObj.find('td').each(function() {
           $(this).removeClass('new-span');
        });
    } else {
        spanSel.css('display', 'block');
    }

    toggleSpan(trObj);
}

// This function is used to gather all the modifications
// made in the browser to pass back to the server, for saving
// the file.
function gatherData() {
    // Initialize the array...
    var data = {'doc_id':docId, 'lines':{}};

    // Get all of the rows...
    var rows = $.find('tr.linerow');
    for (i=0;i<rows.length;i++) {
        var row = rows[i];
        var rowTag = getTag(row);
        var lineNo = getLineNo(row);
        data['lines'][lineNo] = {'tag':rowTag};
        if (rowTag != 'o') {
            data['lines'][lineNo]['span'] = getSpan(row);
        }
    }
    return data;
}

function save() {
    filename = selectedRow.attr('filename');
    $.ajax({
        method:"POST",
        url:baseUrl+"/save/"+dir+filename,
        data:JSON.stringify(gatherData()),
        contentType:'application/json',
        dataType:'json',
        success:saveSuccess,
        error:saveError
    });
}

function saveSuccess(data) {
    alert("Saved successfully");
}

function saveError(data) {
    alert("There was an error saving the document");
}

// Functions for the browser
function selectRow(obj) {
    if (selectedRow)
        selectedRow.removeClass("selected-row");
    selectedRow = $(obj);
    selectedRow.addClass("selected-row");

    var filename = $(obj).attr('filename');
    console.log(baseUrl+'/load/'+dir+filename);

    $.ajax({
        method:'GET',
        contentType:'html',
        success:selectSuccess,
        url:baseUrl+'/load/'+dir+filename
    });
}

function selectSuccess(result) {
    $('#editor').html(result);
}