/**
 * Created by rgeorgi on 3/16/17.
 */

function spanSelect(obj) {
    $(obj).closest('tr');
}

function getTag(trObj) {
    var primaryTag = $(trObj).find('.tag-select').val().toLowerCase();
    var secondaryTag = $(trObj).find('.secondary-tag').val().toLowerCase();
    var tertiaryTag = $(trObj).find('.tertiary-tag').val().toLowerCase();
    // Return the resulting tags, joined with a hyphen.
    if (primaryTag == 'o')
        return 'o';
    else
        return [primaryTag,secondaryTag,tertiaryTag].filter(function(x){return x}).join('-');
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
    trObj.removeClass('tag-noisy tag-g tag-l tag-t tag-m tag-o tag-v');
    var newClass = 'tag-' + tagVal.toLowerCase();
    trObj.addClass(newClass);

    /* Toggle the visibility of the span selector on
        Whether the tag is O or not. */
    var spanSel = trObj.find('.span-select');
    var secondaryTag = trObj.find('.secondary-tag');
    var tertiaryTag = trObj.find('.tertiary-tag');

    if (tagVal == 'O') {
        spanSel.hide();
        secondaryTag.hide();
        tertiaryTag.hide();
        trObj.find('td').each(function() {
           $(this).removeClass('new-span');
        });
    } else {
        spanSel.show();
        secondaryTag.show();
        tertiaryTag.show();
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
        url:baseUrl+"/save/"+enteredDir+filename,
        data:JSON.stringify(gatherData()),
        contentType:'application/json',
        dataType:'json',
        success:saveSuccess,
        error:saveError
    });
}

function saveSuccess(data) {
    alert("Saved successfully");
    selectedRow.addClass('modified');
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
    console.log(baseUrl+'/load/'+enteredDir+filename);

    $.ajax({
        method:'GET',
        contentType:'html',
        success:selectSuccess,
        url:baseUrl+'/load/'+enteredDir+filename
    });
}

function selectSuccess(result) {
    $('#editor').html(result);
}

// Log in (use directory)
function login() {
    var dirname = $('#dirname').val();
    if (!dirname.trim()) {
        $('#messagefield').html("Please enter an access code.")
    } else {
        $.ajax({
            url: baseUrl + '/valid/' + dirname,
            dataType: 'json',
            success: loginSuccess,
            error: loginError
        });
    }
}

function loginError() {
    $('#messagefield').html("There appears to have been an error on the server. Please try again later.");
}

function loginSuccess(r) {
    console.log(r);
    if (r['exists']) {
        window.location.assign(baseUrl+'/dir/'+r['dir']);
    } else {
        $('#messagefield').html("That code appears to be invalid, please check the spelling and try again.")
    }
    // window.location.href();
    // $('body').html(r);
}