'use strict';

/**
 * @description Creates a service instance based on provided ID
 * @param {string} serviceID - Service ID
 * @return {dw.svc.Service} - API Service instance
 */
function getService(serviceID) {
    const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

    return LocalServiceRegistry.createService(serviceID, {
        createRequest: function (svc, data) {
            svc.setRequestMethod('POST');
            svc.addHeader('Content-Type', 'application/json');

            return JSON.stringify(data);
        },
        parseResponse: function (svc, client) {
            return JSON.parse(client.text);
        },
        getRequestLogMessage: function (request) {
            return request;
        },
        getResponseLogMessage: function (response) {
            return response.text;
        }
    });
}

/**
 * @description Invokes preload service call to Moneris payment getaway.
 * The response to the Preload request returns a ticket number which uniquely identifies the instance
 * and must be passed in the JavaScript request in order to display the Moneris Checkout page in the browser.
 * @param {Object} params - Params to be passed
 * @return {dw.svc.Result} - Result of the service call
 */
function preloadCall(params) {
    const shippingAddress = params.lineItemCtnr.defaultShipment.shippingAddress;
    const billingAddress = params.lineItemCtnr.billingAddress;
    const currentCustomer = params.lineItemCtnr.customer;
    const requestObject = {
        store_id: params.store_id,
        api_token: params.api_token,
        checkout_id: params.checkout_id,
        environment: params.instanceType,
        action: 'preload',
        txn_total: params.lineItemCtnr.totalGrossPrice.value,
        ask_cvv: params.ask_cvv ? 'Y' : 'N',
        order_no: params.orderNo,
        dynamic_descriptor: params.dynamic_descriptor,
        language: params.language,
        token: params.token,
        contact_details: {
            first_name: shippingAddress.firstName,
            last_name: shippingAddress.lastName,
            email: params.lineItemCtnr.customerEmail,
            phone: shippingAddress.phone
        },
        shipping_details: {
            address_1: shippingAddress.address1,
            address_2: shippingAddress.address2,
            city: shippingAddress.city,
            province: shippingAddress.stateCode,
            country: shippingAddress.countryCode.value,
            postal_code: shippingAddress.postalCode
        },
        billing_details: {
            address_1: billingAddress.address1,
            address_2: billingAddress.address2,
            city: billingAddress.city,
            province: billingAddress.stateCode,
            country: billingAddress.countryCode.value,
            postal_code: billingAddress.postalCode
        }
    };

    if (currentCustomer && currentCustomer.registered && currentCustomer.authenticated) {
        requestObject.cust_id = customer.ID;
    }

    return getService('moneris.preload').call(requestObject);
}

/**
 * @description Invokes receipt service call to Moneris payment getaway.
 * The receipt request call returns the response which has the details of the transaction and the data to determine whether the transaction was approved or declined.
 * @param {Object} params - Params to be passed
 * @return {Object} - Result of the service call
 */
function receiptCall(params) {
    const requestObject = {
        store_id: params.store_id,
        api_token: params.api_token,
        checkout_id: params.checkout_id,
        environment: params.instanceType,
        action: 'receipt',
        ticket: params.ticket
    };

    const serviceResult = getService('moneris.receipt').call(requestObject);
    return {
        error: !serviceResult.ok,
        unavailableReason: serviceResult.unavailableReason,
        response: serviceResult.ok ? serviceResult.object.response : null
    };
}

/**
 * @description Invokes refund service call to Moneris payment getaway.
 * The result of a service call has the details of the transaction and the data to determine whether the refund was approved or declined.
 * @param {Object} params - Params to be passed
 * @return {Object} - Result of the service call
 */
function refundCall(params) {
    const requestObject = {
        store_id: params.store_id,
        api_token: params.api_token,
        txn_number: params.txn_number,
        order_id: params.order_id,
        amount: params.amount
    };

    const serviceResult = getService('moneris.refund').call(requestObject);

    return {
        error: !serviceResult.ok,
        unavailableReason: serviceResult.unavailableReason,
        response: serviceResult.ok ? serviceResult.object : null
    };
}

/**
 * @description Invokes completion service call to Moneris payment getaway.
 * The completion request call returns the response which has the details of the transaction and the data to determine whether the pre-auth transaction was approved or declined.
 * @param {Object} params - Params to be passed
 * @return {Object} - Result of the service call
 */
function completionCall(params) {
    const requestObject = {
        store_id: params.store_id,
        api_token: params.api_token,
        txn_number: params.txn_number,
        order_id: params.order_id,
        amount: params.amount
    };

    const serviceResult = getService('moneris.preAuthCompletion').call(requestObject);

    return {
        error: !serviceResult.ok,
        unavailableReason: serviceResult.unavailableReason,
        response: serviceResult.ok ? serviceResult.object : null
    };
}

/**
 * @description Invokes void service call to Moneris payment getaway.
 * The void request call returns the response which has the details of the transaction and the data to determine whether the void transaction was approved or declined.
 * @param {Object} params - Params to be passed
 * @return {Object} - Result of the service call
 */
function voidCall(params) {
    const requestObject = {
        store_id: params.store_id,
        api_token: params.api_token,
        txn_number: params.txn_number,
        order_id: params.order_id,
        amount: params.amount
    };

    const serviceResult = getService('moneris.void').call(requestObject);

    return {
        error: !serviceResult.ok,
        unavailableReason: serviceResult.unavailableReason,
        response: serviceResult.ok ? serviceResult.object : null
    };
}

module.exports = {
    preloadCall: preloadCall,
    receiptCall: receiptCall,
    refundCall: refundCall,
    completionCall: completionCall,
    voidCall: voidCall
};
