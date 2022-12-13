'use strict';

/**
 * @description Completion job process function.
 * Makes a completion call for order selected by query. Sets order Payment status and Confirmation status to Paid and Confirmed respectively.
 * In case of failure sets orders status to Cancelled and adds failure message in order's Notes.
 * @returns {dw.system.Status} Status Code
 */
function ordersCompletion() {
    const Order = require('dw/order/Order');
    const OrderMgr = require('dw/order/OrderMgr');
    const Status = require('dw/system/Status');
    const Site = require('dw/system/Site');
    const Transaction = require('dw/system/Transaction');
    const Logger = require('dw/system/Logger').getLogger('Moneris');
    const monerisService = require('*/cartridge/scripts/services/monerisService');
    const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');

    const customPreferences = Site.current.preferences.custom;
    const ORDER_QUERY = 'status = {0} OR status = {1}  AND custom.monerisTransactionCode = {2} AND confirmationStatus = {3} AND shippingStatus = {4} AND custom.monerisTransactionNo != NULL';

    const oredrsToComplete = OrderMgr.searchOrders(
        ORDER_QUERY,
        null,
        Order.ORDER_STATUS_OPEN,
        Order.ORDER_STATUS_NEW,
        monerisHelper.constants.PRE_AUTH_TRANSACTION_CODE,
        Order.CONFIRMATION_STATUS_NOTCONFIRMED,
        Order.SHIPPING_STATUS_SHIPPED
    );

    if (!oredrsToComplete.count) {
        return new Status(Status.OK, null, 'No Orders found');
    }

    try {
        let order = null;
        let orderId = '';
        let amount = '';
        let requestData = {};
        let serviceResult = null;
        let response = null;

        while (oredrsToComplete.hasNext()) {
            order = oredrsToComplete.next();
            orderId = order.orderNo;
            amount = String(order.paymentTransaction.amount.value);
            requestData = {
                store_id: customPreferences.monerisStoreId,
                api_token: customPreferences.monerisApiToken,
                txn_number: order.paymentTransaction.transactionID,
                order_id: orderId,
                amount: amount
            };

            // The following implemented for testing purposes
            if (monerisHelper.getInstanceType() === 'qa') {
                requestData.txn_number = order.custom.monerisTransactionNo;
            }

            serviceResult = monerisService.completionCall(requestData);
            if (serviceResult.error) {
                if (serviceResult.unavailableReason) {
                    Logger.error('Service error: {0}', serviceResult.unavailableReason);
                    throw new Error(serviceResult.unavailableReason);
                } else {
                    Logger.error('Completion request error: {0}', serviceResult.errorMessage);
                }
            }

            response = serviceResult.response;
            // eslint-disable-next-line no-loop-func
            Transaction.wrap(() => {
                if (response.ResponseCode &&
                    Number(response.ResponseCode) <= monerisHelper.constants.APPROVAL_CODE) {
                    order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                    order.paymentTransaction.transactionID = response.TxnNumber;
                    order.custom.monerisTransactionNo = response.TxnNumber;
                    order.addNote('Pre-Auth Completion request is APPROVED.', response.Message);
                } else {
                    order.addNote('Completion request is DECLINED. Reason: ', response.Message);
                    order.setStatus(Order.ORDER_STATUS_CANCELLED);
                    Logger.error('Order {0} capture is failed', requestData.order_id);
                }
            });
        }

        return new Status(Status.OK);
    } catch (error) {
        return new Status(Status.ERROR, 'Moneris Pre-Auth Completion', error);
    }
}

module.exports = {
    ordersCompletion: ordersCompletion
};
