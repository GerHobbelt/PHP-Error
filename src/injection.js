"use strict";

(function( window ) {
    if ( window.XMLHttpRequest ) {
        /** 
         * A method wrapping helper function.
         * 
         * Wraps the method given, from the old prototype to the new
         * XMLHttpRequest prototype.
         * 
         * This only happens if the old one actually has that prototype.
         * If the browser doesn't support a prototype, then it doesn't
         * get wrapped.
         */
        var wrapMethod = function( XMLHttpRequest, old, prop ) {
            if ( old.prototype[prop] ) {
                var behaviours = ( arguments.length > 3 ) ?
                        Array.prototype.slice.call( arguments, 3 ) :
                        null ;

                XMLHttpRequest.prototype[prop] = function() {
                    if ( behaviours !== null ) {
                        for ( var i = 0; i < behaviours.length; i++ ) {
                            behaviours[i].call( this, arguments, prop );
                        }
                    }

                    return this.__.inner[prop].apply( this.__.inner, arguments );
                };
            }
        }

        var postMethod = function( XMLHttpRequest, prop ) {
            if ( XMLHttpRequest.prototype[prop] ) {
                var behaviours = Array.prototype.slice.call( arguments, 2 );

                var previous = XMLHttpRequest.prototype[prop];
                XMLHttpRequest.prototype[prop] = function() {
                    var r = previous.apply( this, arguments );

                    for ( var i = 0; i < behaviours.length; i++ ) {
                        behaviours[i].call( this, arguments, prop );
                    }

                    return r;
                };
            }
        }

        /*
         * Certain properties will error when read,
         * and which ones do vary from browser to browser.
         * 
         * I've found both Chrome and Firefox will error
         * on _different_ properties.
         * 
         * So every read needs to be wrapped in a try/catch,
         * and just hope it doesn't error.
         */
        var copyProperties = function( src, dest, props ) {
            for ( var i = 0; i < props.length; i++ ) {
                try {
                    var prop = props[i];
                    dest[prop] = src[prop];
                } catch( ex ) { }
            }
        };

        var copyResponseProperties = function( src, dest ) {
            copyProperties( src, dest, [
                    'response',
                    'responseText',
                    'responseXML'
            ]);
        }

        var copyRequestProperties = function( src, dest, includeReadOnly, skipResponse ) {
            copyProperties( src, dest, [
                    'readyState',
                    'timeout',
                    'upload',
                    'withCredentials',
                    'responseType',

                    'mozBackgroundRequest',
                    'mozArrayBuffer',
                    'multipart'
            ]);

            if ( includeReadOnly ) {
                copyProperties( src, dest, [
                        'status',
                        'statusText',
                        'channel'
                ]);

                if ( ! skipResponse ) {
                    copyResponseProperties( src, dest );
                }
            }

            return dest;
        }

        var runFail = function( ev ) {
            var self = this;
            var xmlHttpRequest = this.__.inner;

            var iframe = document.createElement('iframe');
            iframe.setAttribute('width', '100%');
            iframe.setAttribute('height', '100%');
            iframe.setAttribute('src', 'about:blank');

            iframe.style.transition =
            iframe.style.OTransition =
            iframe.style.MsTransition =
            iframe.style.MozTransition =
            iframe.style.WebkitTransition = 'opacity 200ms linear';

            iframe.style.background = 'transparent';
            iframe.style.opacity = 0;
            iframe.style.zIndex = 100001;
            iframe.style.top = 0;
            iframe.style.right = 0;
            iframe.style.left = 0;
            iframe.style.bottom = 0;
            iframe.style.position = 'fixed';

            var response = xmlHttpRequest.responseText;

            iframe.onload = function() {
                var iDoc = iframe.contentWindow || iframe.contentDocument;
                if ( iDoc.document) {
                    iDoc = iDoc.document;
                }

                var iBody = iDoc.getElementsByTagName("body")[0];
                iBody.innerHTML = response; 
                var iHead = iDoc.getElementsByTagName("head")[0];

                // re-run the script tags
                var scripts = iDoc.getElementsByTagName('script');
                for ( var i = 0; i < scripts.length; i++ ) {
                    var script = scripts[i];
                    var parent = script.parentNode;

                    if ( parent ) {
                        parent.removeChild( script );

                        var newScript = iDoc.createElement('script');
                        newScript.innerHTML = script.innerHTML;

                        iHead.appendChild( newScript );
                    }
                }

                var closed = false;
                var closeIFrame = function() {
                    if ( ! closed ) {
                        closed = true;

                        iframe.style.opacity = 0;

                        setTimeout( function() {
                            iframe.parentNode.removeChild( iframe );
                        }, 220 );
                    }
                }

                /*
                 * Retry Handler.
                 * 
                 * Clear this, make a new (real) XMLHttpRequest,
                 * and then re-run everything.
                 */
                var retry = iDoc.getElementById('ajax-retry');
                if ( retry ) {
                    retry.onclick = function() {
                        var methodCalls = self.__.methodCalls;

                        initializeXMLHttpRequest.call( self );
                        for ( var i = 0; i < methodCalls.length; i++ ) {
                            var method = methodCalls[i];
                            self[method.method].apply( self, method.args );
                        }

                        closeIFrame();

                        return false;
                    };

                    /*
                     * The close handler.
                     * 
                     * When closed, the response is cleared,
                     * and then the request finishes with null info.
                     */
                    iDoc.getElementById('ajax-close').onclick = function() {
                        copyRequestProperties( self.__.inner, self, true );

                        // clear the response
                        self.response       = '';
                        self.responseText   = '';
                        self.responseXML    = null;

                        if ( self.onreadystatechange ) {
                            self.onreadystatechange( ev );
                        }

                        closeIFrame();
                        return false;
                    };

                    var html = iDoc.getElementsByTagName('html')[0];
                    html.setAttribute( 'class', 'ajax' );

                    setTimeout( function() {
                        iframe.style.opacity = 1;
                    }, 1 );
                }
            }

            /*
             * Placed inside a timeout, incase the document doesn't exist yet.
             * 
             * Can happen if the page ajax's straight away.
             */
            setTimeout( function() {
                var body = document.getElementsByTagName('body')[0];
                body.appendChild( iframe );
            }, 1 );
        }

        var old = window.XMLHttpRequest;

        /**
         * The middle man http request object.
         * 
         * Acts just like a normal one, but will show errors if they
         * occur instead of running the result.
         */
        var XMLHttpRequest = function() {
            initializeXMLHttpRequest.call( this );
        }

        var initializeXMLHttpRequest = function() {
            var self = this,
                inner = new old();

            /**
             * With a buggy XMLHttpRequest, it's possible to accidentally run the error handler
             * multiple times.
             * 
             * This is a flag to only do it once, to keep the code more defensive.
             */
            var errorOnce   = true,
                isAjaxError = false;

            var stateResults = [];

            inner.onreadystatechange = function( ev ) {
                copyRequestProperties( inner, self, true, true );

                var state = inner.readyState;

                /*
                 * Check headers for error.
                 */
                if ( ! isAjaxError && state >= 2 ) {
                    /*
                     * It's null in some browsers, and an empty string in others.
                     */
                    var header = inner.getResponseHeader( '<?php echo ErrorHandler::PHP_ERROR_MAGIC_HEADER_KEY ?>' );

                    if ( header !== null && header !== '' ) {
                        self.__.isAjaxError = true;
                        isAjaxError = true;
                    }
                }

                if ( ! isAjaxError && state >= 2 ) {
                    copyResponseProperties( inner, self );
                }

                /*
                 * Success ! \o/
                 * 
                 * Pass any state change on to the parent caller,
                 * unless we hit an ajaxy error.
                 */
                if ( !isAjaxError && self.onreadystatechange ) {
                    /*
                     * One of three things happens:
                     *  = cache the requests until we know there is no error (state 4)
                     *  = we know there is no error, and so we run our cache
                     *  = cache is done, but we've been called again, so just pass it on
                     */
                    if ( state < 4 ) {
                        stateResults.push( copyRequestProperties(self, {}, true) );
                    } else {
                        if ( stateResults !== null ) {
                            var currentState = copyRequestProperties( self, {}, true );

                            for ( var i = 0; i < stateResults.length; i++ ) {
                                var store = stateResults[i];
                                copyRequestProperties( store, self, true );

                                // must check a second time here,
                                // in case it gets changed within an onreadystatechange
                                if ( self.onreadystatechange ) {
                                    self.onreadystatechange( ev );
                                }
                            }

                            copyRequestProperties( currentState, self, true );
                            stateResults = null;
                        }

                        if ( self.onreadystatechange ) {
                            self.onreadystatechange( ev );
                        }
                    }
                }

                /*
                 * Fail : (
                 */
                if (
                        isAjaxError &&
                        state === 4 &&
                        errorOnce
                ) {
                    errorOnce = false;
                    if ( window.console && window.console.log ) {
                        window.console.log( 'Ajax Error Calling: ' + self.__.url );
                    }

                    runFail.call( self, ev );
                }
            };

            copyRequestProperties( inner, this, true );

            /*
             * Private fields are stored underneath the unhappy face,
             * to localize them.
             * 
             * Access becomes:
             *  this.__.fieldName
             */
            this.__ = {
                    methodCalls: [],
                    inner: inner,
                    isAjaxError: false,
                    isSynchronous: false,
                    url: ''
            };
        }

        /*
         * We build the methods for the fake XMLHttpRequest.
         */

        var copyIn = function() {
            copyRequestProperties( this, this.__.inner );
        }
        var copyOut = function() {
            copyRequestProperties( this.__.inner, this, true, this.__.isSynchronous && this.__.isAjaxError );
        }
        var addHeader = function() {
            this.__.inner.setRequestHeader( 'HTTP_X_REQUESTED_WITH', 'XMLHttpRequest' );
        }
        var isSynchronous = function( args ) {
            this.__.isSynchronous = ( args[2] === false );
        }
        var saveRequest = function( args, method ) {
            this.__.methodCalls.push({
                method: method,
                args: args
            });
        }
        var grabOpen = function( args, method ) {
            this.__.url = args[1];
        }

        wrapMethod( XMLHttpRequest, old, 'open'        , saveRequest, copyIn, isSynchronous, grabOpen );
        wrapMethod( XMLHttpRequest, old, 'abort'       , saveRequest, copyIn );
        wrapMethod( XMLHttpRequest, old, 'send'        , saveRequest, copyIn, addHeader );
        wrapMethod( XMLHttpRequest, old, 'sendAsBinary', saveRequest, copyIn, addHeader );

        postMethod( XMLHttpRequest,      'send'        , copyOut );
        postMethod( XMLHttpRequest,      'sendAsBinary', copyOut );

        wrapMethod( XMLHttpRequest, old, 'getAllResponseHeaders', saveRequest );
        wrapMethod( XMLHttpRequest, old, 'getResponseHeader'    , saveRequest );
        wrapMethod( XMLHttpRequest, old, 'setRequestHeader'     , saveRequest );
        wrapMethod( XMLHttpRequest, old, 'overrideMimeType'     , saveRequest );

        window.XMLHttpRequest = XMLHttpRequest;
    }
})( window );
