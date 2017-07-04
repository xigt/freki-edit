/**
 * Created by rgeorgi on 3/16/17.
 */


function getFlags(trObj) {
    var panel = $(trObj).find('.flag-combo').combo('panel');
    var checked = panel.find(':checked');
    var flagArr = [];
    checked.each(function(idx, elt) {
        flagArr.push($(elt).val());
    });
    return flagArr.join('+');
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

function getFullTag(trObj) {
    var multiTag = getTag(trObj);
    var flags = getFlags(trObj);
    if (flags.length > 0)
        return multiTag + '+' + flags;
    else
        return multiTag;
}

function getSpan(trObj) {return $(trObj).find('.span-select').val();}

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
    updateSpanMeta(trObj);
    // Mark the file as having been modified
    hasBeenModified = true;
}


function updateSpanMeta(trObj) {
    var spanType = getSpan(trObj);
    var lineno = getLineNo(trObj);
    var meta = lsMeta();
    meta[lineno]['span_type'] = spanType.split('-')[0];
    lsMeta(meta);
}

function updateTagDisplay(trObj) {
    var tagS = $(trObj).find('.tag-select');
    var tagVal = tagS.val();

    // remove classes not being used.
    for (i=0;i<tags.length;i++) {
        tag = tags[i];
        trObj.removeClass(tag);
    }
    trObj.removeClass('tag-noisy');

    if (tagVal.startsWith('*')) {
        trObj.addClass('tag-noisy');
    } else {
        var newClass = 'tag-' + tagVal.toLowerCase();
        trObj.addClass(newClass);
    }

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
    }

    toggleSpan(trObj);

}

function tagSelect(obj) {
    var tr = $(obj).closest('tr')
    updateTagDisplay(tr);
    updateTagMeta(tr);
    // Mark the file as having been modified
    hasBeenModified = true;
}

// Update the stored metadata when the tag is changed.
function updateTagMeta(rowObj) {
    var tag = getFullTag(rowObj).toUpperCase();
    var lineNo = getLineNo(rowObj);
    var meta = lsMeta();
    meta[lineNo]['tag'] = tag;
    lsMeta(meta);
}

// This function is used to gather all the modifications
// made in the browser to pass back to the server, for saving
// the file.
function gatherData() {
    // Initialize the array...
    var data = {};

    // Get all of the rows...
    var rows = $.find('tr.linerow');
    for (i=0;i<rows.length;i++) {
        var row = rows[i];
        var rowTag = getTag(row);
        var rowFlags = getFlags(row);
        var lineNo = getLineNo(row);
        data[lineNo] = {'tag':rowTag};
        if (rowTag != 'o') {
            data[lineNo]['span'] = getSpan(row);
            data[lineNo]['flags'] = rowFlags;
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

// Load the text or full metadata.
function showLoading() { $('#editor-contents').html(''); $('#loading').show(); }
function hideLoading(content) { $('#loading').hide(); $('#editor-contents').html(content); $('#editor').scrollTop(0);}

// Load data from the server.
function doLoad(filename, startLine, includeMeta) {
    // Set startline to 1 if undefined.
    if (startLine === undefined) startLine = 1;
    // includemeta is true by default.
    if (includeMeta === undefined) includeMeta = true;

    // Show the loading spinner while we wait for results
    showLoading();

    // Switch between the text-only request and the
    // full metadata update
    var successFunc = includeMeta ? loadSuccess : textSuccess;
    var apiHook = includeMeta ? '/load/' : '/text/';


    $.ajax({
        method:'GET',
        dataType:'json',
        data:{start:startLine, range:getNumLines()},
        success:successFunc,
        error:loadError,
        url:baseUrl+apiHook+enteredDir+filename
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



function unsetRange() {$('#range-placeholder').show(); $('#range').hide(); }
function setRange(start, stop, max) {$('#range-placeholder').hide();$('#range').show();$('#start_line').text(start);$('#stop_line').text(stop);$('#max_lines').text(max);$('#goto').val(start);$('#goto-error').text('');}

// Check the current displayed range
// and disable the prev/next buttons as required.
function checkPrevNext(start, stop, max) {
    if (start == 1) $('#prev').prop('disabled', true); else $('#prev').prop('disabled', false);
    if (stop >= max) $('#next').prop('disabled', true); else $('#next').prop('disabled', false);
}

function finishLoading(result, metaIsNew) {
    var html = result['html'];
    var start = result['start_line']; lsStart(start);
    var end = result['end_line']; lsLast(end);
    var max = result['max_line']; lsMax(max);
    var docid = result['doc_id']; lsDocId(docid);
    if (metaIsNew) {console.log('Reloading meta'); lsMeta(result['meta']);}

    // Hide the loading spinner and load
    // the requested HTML content.
    hideLoading(html);

    // Display the correct line range.
    setRange(start, end, max);

    // Disable previous/next as needed
    checkPrevNext();

    // Now do the parsing of the metadata.
    parseMeta();

    // update the combo box displays.
    bindCombos();
}

// -------------------------------------------
// Load functions
// -------------------------------------------

// When loading the document was successful.
function loadSuccess(result) {finishLoading(result, true);}

// When loading the document failed.
function loadError(result) {
    $('#loading').hide();
    $('#editor-contents').text("There was an error loading the document.");
    unsetRange();
}

function textSuccess(result) {finishLoading(result, false);}

// Different pagination functions
function accessLS(k, v) {if (v !== undefined) localStorage.setItem(k, v); else  return localStorage.getItem(k);}
function lsMax(newVal) {return accessLS('maxLine', newVal);}
function lsLast(newVal) {return accessLS('lastLine', newVal);}
function lsStart(newVal) {return accessLS('startLine', newVal);}
function lsDocId(newVal) {return accessLS('docId', newVal);}

function lsMeta(newMeta) {
    if (newMeta === undefined)
        return JSON.parse(localStorage.getItem('meta'));
    else
        localStorage.setItem('meta',JSON.stringify(newMeta))
}


function loadNext() {doLoad(lsDocId(), lsLast(), false);}

function loadPrev() {
    var startLine = Math.max(1, lsStart()-getNumLines());
    doLoad(lsDocId(), startLine, false);
}

function jumpToLine(elt) {
    var startLine = parseInt($(elt).val(), false);

    // Do some error checking.
    if (startLine < lsMax() && startLine >= 1)
        doLoad(lsDocId(), startLine, false);
    else
        $('#goto-error').text("Invalid line to jump to.")
}

// Bind the flag fields to easyui combo elements
function bindCombos() {
    $('.flagcell').each(function(idx, flagcellElt) {
        var flagCombo = $(flagcellElt).find('.flag-combo');

        flagCombo.combo({
            multiple:true,
            checkbox: true,
            editable:false,
            panelHeight: 'auto'
        });

        var flags = $(flagcellElt).find('.flags');
        var panel = flagCombo.combo('panel');

        panel.append(flags);

        // Now, each time a checkbox is clicked, update the flags.
        flags.find('input').each(function (i, checkElt) {
            $(checkElt).click(function() {
                updateFlagDisplay(flagcellElt);
                var tr = $(flagcellElt).closest('tr');
                updateTagMeta(tr);
            });
        });

        updateFlagDisplay(flagcellElt);
    });

}

function updateFlagDisplay(flagCellElt) {
    var comboElt = $(flagCellElt).find('.flag-combo');
    comboElt.combo('setText', getFlags(flagCellElt));
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

function loginError() {$('#messagefield').html("There appears to have been an error on the server. Please try again later.");}
function loginSuccess(r) {
    if (r['exists']) {
        window.location.assign(baseUrl+'/dir/'+r['dir']);
    } else {
        $('#messagefield').html("That code appears to be invalid, please check the spelling and try again.")
    }
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
    bindFilelist();
    doResize();
});