'use strict';

const server = require('server');

server.extend(module.superModule);

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');


/**
 * Checkout-Begin : This method prepends Checkout-Begin endpoint, it is needed to identify if page refresh was performed on placeOrder
 * if so, user will be redirected to the previous stage
 * @name Base/Checkout-Begin
 * @function
 * @memberof Checkout
 * @param {middleware} - server.middleware.https
 * @param {middleware} - consentTracking.consent
 * @param {middleware} - csrfProtection.generateToken
 * @param {querystringparameter} - stage - a flag indicates the checkout stage
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.prepend(
    'Begin',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        const stage = res.viewData && res.viewData.queryString;
        if (stage === 'stage=placeOrder') {
            const URLUtils = require('dw/web/URLUtils');
            res.redirect(URLUtils.abs('Checkout-Begin', 'stage', 'payment'));
        }
        return next();
    }
);

module.exports = server.exports();
