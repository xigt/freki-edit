/**
 * Created by rgeorgi on 7/1/17.
 */

function parseMeta() {
    var metaJSON = JSON.parse(meta());

    $('.linerow').each(function(idx, obj) {
        var lineno = parseInt($(obj).find('.lineno').attr('lineno'));

        // First, set the span type.
        var spanType = metaJSON[lineno]['span_type'];
        if (spanType === undefined) spanType = 'prev';
        $(obj).addClass(spanType+'-span');
        $(obj).find('.span-select').val(spanType+'-span');


        // Next, set the tag.
        var tag = metaJSON[lineno]['tag'].toLowerCase();

        var allTags = tag.split('+')[0].split('-');
        var allFlags = tag.split('+').slice(1);

        var primaryTag = allTags[0];
        var primaryTagU = primaryTag.toUpperCase();

        // Set Primary Tag
        var ts = $(obj).find('.tag-select');

        // check to see if the primary tag is an option...
        if (ts.find('[value="'+primaryTagU+'"]').length == 0) {
            ts.prepend('<OPTION value="'+primaryTagU+'" selected="selected">'+primaryTagU+'</OPTION>');
        } else {
            ts.val(primaryTag.toUpperCase());
        }

        // Set extra tags.
        if (allTags.length > 1) $(obj).find('.secondary-tag').val(allTags[1].toUpperCase());
        if (allTags.length > 2) $(obj).find('.tertiary-tag').val(allTags[2].toUpperCase());

        // Check the appropriate flags.
        for (i=0; i<allFlags.length; i++) {
            var flag = allFlags[i].toUpperCase();
            var checkbox = $(obj).find('.flags [value="'+flag+'"]');
            checkbox.attr('checked','checked');
        }

        // Do the display stuff necessary
        updateTagDisplay($(obj));


    });
}