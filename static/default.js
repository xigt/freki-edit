/**
 * Created by rgeorgi on 3/16/17.
 */

// This function is intended
// to check all the flags in the
// current flagcell (TD) and set the
// "flagged" status appropriately.
function checkFlags(obj) {
    var tdObj = $(obj).closest('td');
    var checked = tdObj.find(':checked');
    if (checked.length > 0) {
        tdObj.addClass('flagged');
    } else {
        tdObj.removeClass('flagged');
    }
}

function getFlags(trObj) {
    var checked = $(trObj).find('.flags input:checked');
    var flagArr = [];
    checked.each(function(idx, elt) {
        flagArr.push($(elt).val());
    });
    console.log(flagArr.join('+'));
    return flagArr;
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


function toggleSpan(trObj) {
    var isO = getTag(trObj) == 'o';
    if (isO) {
        $(trObj).removeClass('new-span');
        $(trObj).removeClass('cont-span');
    } else if (getSpan(trObj) == 'new-span') {
        $(trObj).addClass('new-span');
        $(trObj).removeClass('cont-span');
    } else if (getSpan(trObj) == 'cont-span') {
        $(trObj).removeClass('new-span');
        $(trObj).addClass('cont-span');
    } else {
        $(trObj).removeClass('new-span');
        $(trObj).removeClass('cont-span');
    }
}

function spanSelect(obj) {
    var trObj = $(obj).closest('tr');
    toggleSpan(trObj);
    // Mark the file as having been modified
    hasBeenModified = true;
}

function tagSelect(obj) {
    var tagVal = $(obj).val();
    var trObj = $(obj).closest('tr');

    // remove classes not being used.
    for (i=0;i<tags.length;i++) {
        tag = tags[i];
        trObj.removeClass(tag);
    }
    trObj.removeClass('tag-noisy');

    var newClass = 'tag-' + tagVal.toLowerCase();
    trObj.addClass(newClass);

    /* Toggle the visibility of the span selector on
        Whether the tag is O or not. */
    var spanSel = trObj.find('.span-select');
    var secondaryTag = trObj.find('.secondary-tag');
    var tertiaryTag = trObj.find('.tertiary-tag');
    var flagCell = trObj.find('.flagcell-contents');
    var flagTD = trObj.find('.flagcell');

    if (tagVal == 'O') {
        spanSel.hide();
        secondaryTag.hide();
        tertiaryTag.hide();
        flagCell.hide();
        flagTD.removeClass('flagged');
        trObj.find('td').each(function() {
           $(this).removeClass('new-span');
        });
    } else {
        flagCell.show();
        spanSel.show();
        secondaryTag.show();
        tertiaryTag.show();
        checkFlags(flagTD);
    }

    toggleSpan(trObj);

    // Mark the file as having been modified
    hasBeenModified = true;
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
        var rowFlags = getFlags(row);
        var lineNo = getLineNo(row);
        data['lines'][lineNo] = {'tag':rowTag};
        if (rowTag != 'o') {
            data['lines'][lineNo]['span'] = getSpan(row);
            data['lines'][lineNo]['flags'] = rowFlags;
        }
    }
    return data;
}

// =============================================================================
// FUNCTIONS FOR SAVING/"FINISHING" Documents
// =============================================================================

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
    selectedRow.removeClass('finished');
    hasBeenModified = false;
}

function saveError(data) {
    alert("There was an error saving the document");
}

// -------------------------------------------
// Finish
// -------------------------------------------
function finish() {
    filename = selectedRow.attr('filename');
    $.ajax({
        method:"POST",
        url:baseUrl+"/finish/"+enteredDir+filename,
        data:JSON.stringify(gatherData()),
        contentType:'application/json',
        success:finishSuccess,
        error:finishError
    })
}

function finishSuccess(r) {
    selectedRow.addClass('finished');
    alert("File is marked as finished!");
    hasBeenModified = false;
}

function finishError(r) {
    alert("There was an error.");
}

function doLoad(filename) {
    $.ajax({
        method:'GET',
        contentType:'html',
        success:selectSuccess,
        url:baseUrl+'/load/'+enteredDir+filename
    });
}

// Functions for the browser
function selectRow(filename) {
    if (hasBeenModified) {
        var dontSave = confirm("This file has been modified and not saved. Would you still like to open a new file?");
        if (dontSave) {
            doLoad(filename);
            hasBeenModified = false;
        }
    } else {
        doLoad(filename);
    }

}

function selectSuccess(result) {
    $('#editor').html(result);
    $('#editor').scrollTop();
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
    if (r['exists']) {
        window.location.assign(baseUrl+'/dir/'+r['dir']);
    } else {
        $('#messagefield').html("That code appears to be invalid, please check the spelling and try again.")
    }
    // window.location.href();
    // $('body').html(r);
}

function showFlags(obj) {
    var td = $(obj).closest('td');
    td.find('.flagsshow').hide();
    td.find('.flags').show();
}

function hideFlags(obj) {
    var td = $(obj).closest('td');
    td.find('.flags').hide();
    td.find('.flagsshow').show();
}

// Bind click action to filelist
function bindFilelist() {
    $('#filelist').datalist({
        onSelect: function (idx, row) {
                        selectRow(row['value']);
                        },
        rowStyler: function(idx, row) {
            if (row['value']) {
                if (saves[row['value']] === true) {
                    return 'color:red';
                }  else if (saves[row['value']] === false) {
                    return 'color:pink';
                }
            }
        }
    });
}

//
function doResize() {
    var mw = $('#mainwindow');
    var newHeight = $(document).height();
    mw.layout('resize', {height:newHeight-35});
}

$(window).resize(function() {
    doResize();
});

$(document).ready(function (){
    // doResize();
    bindFilelist();
});