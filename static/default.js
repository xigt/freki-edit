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

function getNumLines() {return parseInt($('#numlines').val());}

function doLoad(filename, startLine) {
    if (startLine === undefined)
        startLine = 1;

    $('#editor-contents').html('');
    $('#loading').show();

    $.ajax({
        method:'GET',
        dataType:'json',
        data:{start:startLine, range:getNumLines()},
        success:loadSuccess,
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

function loadSuccess(result) {
    var htmlResult = result['html'];
    var myStart = result['start_line'];
    var endLine = result['end_line'];
    var myMax = result['max_line'];

    $('#loading').hide();
    $('#editor-contents').html(htmlResult);
    $('#editor').scrollTop(0);

    // Modify the aspects of the
    $('#range-placeholder').hide();
    $('#range').show();
    $('#start_line').text(myStart);
    $('#stop_line').text(endLine);
    $('#max_lines').text(myMax);
    $('#goto').val(myStart);
    $('#goto-error').text('');

    // Disable previous when on fist line:
    if (myStart == 1)
        $('#prev').prop('disabled', true);
    else
        $('#prev').prop('disabled', false);

    startLine(myStart);
    lastLine(endLine);
    maxLine(myMax);
    localStorage.setItem('docId', result['doc_id']);

    bindCombos();
}

function ls(k, v) {
    if (v !== undefined)
        localStorage.setItem(k, v);
    else
        return localStorage.getItem(k);
}

// Different pagination functions
function maxLine(newVal) {return ls('maxLine', newVal);}
function lastLine(newVal) {return ls('lastLine', newVal);}
function startLine(newVal) {return ls('startLine', newVal);}

function loadNext() {
    doLoad(localStorage.getItem('docId'), lastLine());
}

function loadPrev() {
    var startLine = Math.max(1, localStorage.getItem('startLine')-getNumLines());
    doLoad(localStorage.getItem('docId'), startLine);
}

function jumpToLine(elt) {
    var startLine = parseInt($(elt).val());

    // Do some error checking.
    if (startLine < maxLine() && startLine >= 1)
        doLoad(localStorage.getItem('docId'), startLine);
    else
        $('#goto-error').text("Invalid line to jump to.")
}

// Bind the flag fields to easyui combo elements
function bindCombos() {
    $('.flagcell').each(function(idx, elt) {
        var flagCombo = $(elt).find('.flag-combo');

        flagCombo.combo({
            multiple:true,
            checkbox: true,
            editable:false,
            panelHeight: 'auto'
        });

        var flags = $(elt).find('.flags');
        var panel = flagCombo.combo('panel');

        panel.append(flags);

        // Now, each time a checkbox is clicked, update the flags.
        flags.find('input').each(function (i, elt) {
            $(elt).click(function() {
                updateCombo(flagCombo, flags);
            });
        });

        updateCombo(flagCombo, flags);
    });

}

function updateCombo(comboElt, flags) {
    var flagArr = [];
    $(flags).find('input').each(function(i, flagElt) {
        var v = $(flagElt).val();
        if ($(flagElt).is(':checked')) {
            flagArr.push(v);
        }
    });
    $(comboElt).combo('setText', flagArr.join('+'));
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