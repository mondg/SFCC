'use strict';

const customerHelpers = require('base/checkout/customer');
const shippingHelpers = require('base/checkout/shipping');
const summaryHelpers = require('base/checkout/summary');
const billingHelpers = require('./billing');
const baseCheckout = require('base/checkout/checkout');
const monerisCheckout = require('./monerisCheckout');

// Removes class to which focus() method is applied to prevent scroll
document.querySelector('.logo-home').classList.remove('logo-home');

// Stops animate() method before it starts
$(document).ajaxComplete(function () {
    $('html, body').stop();
});

const monerisElementent = document.getElementById('monerisCheckout');
if (monerisElementent && monerisElementent.offsetParent !== null) {
    monerisCheckout.monerisInit(monerisElementent);
}

baseCheckout.updateCheckoutView = function () {
    $('body').on('checkout:updateCheckoutView', function (e, data) {
        if (data.csrfToken) {
            $('input[name*="csrf_token"]').val(data.csrfToken);
        }
        customerHelpers.methods.updateCustomerInformation(data.customer, data.order);
        shippingHelpers.methods.updateMultiShipInformation(data.order);
        summaryHelpers.updateTotals(data.order.totals);
        data.order.shipping.forEach(function (shipping) {
            shippingHelpers.methods.updateShippingInformation(
                shipping,
                data.order,
                data.customer,
                data.options
            );
        });
        billingHelpers.methods.updateBillingInformation(
            data.order,
            data.customer,
            data.options
        );
        billingHelpers.methods.updatePaymentInformation(data.order, data.options);
        summaryHelpers.updateOrderProductSummaryInformation(data.order, data.options);
    });
};

module.exports = baseCheckout;
