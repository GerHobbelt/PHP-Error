"use strict";

$(document).ready( function() {
    $('#ajax-close', '#ajax-retry').click( function(ev) {
        ev.preventDefault();
    });

    if ( $('#error-files').size() > 0 && $('#error-stack-trace').size() > 0 ) {
        var FADE_SPEED = 150,
            lines = $('#error-files .error-file-lines'),
            currentID = '#' + lines.filter( '.show' ).attr( 'id' );

        var filename   = $('#error-filename'),
            linenumber = $('#error-linenumber');

        $( '.error-stack-trace-line' ).
                mouseover( function() {
                    var $this = $(this);

                    if ( ! $this.hasClass('select-highlight') ) {
                        $this.addClass( 'select-highlight' );
                    }
                }).
                mouseout( function(ev) {
                    var $this = $(this);

                    $this.removeClass( 'select-highlight' );
                }).
                click( function() {
                    var $this = $(this);

                    if ( ! $this.hasClass('highlight') && !$this.hasClass('is-native') ) {
                        $( '.error-stack-trace-line.highlight' ).removeClass( 'highlight' );

                        $this.addClass( 'highlight' );

                        var lineID = $this.data( 'file-lines-id' );
                        if ( lineID ) {
                            var newCurrent = '#' + lineID;

                            if ( newCurrent !== currentID ) {
                                currentID = newCurrent;

                                lines.removeClass( 'show' );
                                lines.filter( currentID ).addClass( 'show' );

                                var $file = $this.find('.filename');
                                var file = $file.text(),
                                    line = $this.find('.linenumber').text();

                                filename.text( file );
                                filename.attr( 'class', $file.attr('class') );
                                linenumber.text( line );
                            }
                        }
                    }
                });
        $('#error-stack-trace').mouseleave( function() {
            lines.filter('.show').removeClass( 'show' );
            lines.filter( currentID ).addClass( 'show' );
        });
    }
} );
