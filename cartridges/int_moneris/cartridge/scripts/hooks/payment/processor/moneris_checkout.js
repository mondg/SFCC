'use strict';

const monerisHelper = require('*/cartridge/scripts/helpers/monerisHelper');

/**
 * @description Moneris Handle hook
 * @param {dw.order.Basket} basket - API Basket instance
 * @param {Object} paymentInformation - Payment information object
 * @param {string} paymentMethodID - Payment method ID
 * @return {Object} - Handling result
 */
function Handle(basket, paymentInformation, paymentMethodID) {
    const Transaction = require('dw/system/Transaction');
    const collections = require('*/cartridge/scripts/util/collections');

    const currentBasket = basket;
    const result = {
        error: true,
        serverErrors: [],
        fieldErrors: []
    };

    try {
        const ticket = monerisHelper.getTicket();

        Transaction.wrap(() => {
            const paymentInstruments = currentBasket.getPaymentInstruments(paymentMethodID);

            collections.forEach(paymentInstruments, function (item) {
                currentBasket.removePaymentInstrument(item);
            });

            currentBasket.createPaymentInstrument(paymentMethodID, currentBasket.totalGrossPrice);

            if (ticket) {
                result.error = false;
            }
        });

        session.privacy.ticket = ticket;
    } catch (e) {
        const errorMessage = require('dw/web/Resource').msg('error.technical', 'checkout', null);

        result.serverErrors.push(errorMessage);
    }

    return result;
}

/**
 * @description Moneris Authorize hook
 * @param {string} orderNumber - Order number
 * @param {dw.order.PaymentInstrument} paymentInstrument - API PaymentInstrument instance
 * @param {dw.order.PaymentProcessor} paymentProcessor - API PaymentProcessor instance
 * @return {Object} - Authorization result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    const Resource = require('dw/web/Resource');
    const Money = require('dw/value/Money');
    const Transaction = require('dw/system/Transaction');
    const CustomerMgr = require('dw/customer/CustomerMgr');
    const OrderMgr = require('dw/order/OrderMgr');
    const Order = require('dw/order/Order');
    const order = OrderMgr.getOrder(orderNumber, session.privacy.orderToken);
    const result = {
        error: true
    };

    if (!order) {
        return result;
    }

    const receiptObject = monerisHelper.getReceipt(order.custom.monerisTicket);

    if (receiptObject.error || !receiptObject.response || receiptObject.response.error) {
        result.skipOrder = true;
        result.errorMessage = receiptObject.unavailableReason ? 'Service Error' : 'Incomplete order';

        return result;
    }

    const receipt = receiptObject.response.receipt;
    const transactionNo = [];
    const transactionCode = [];
    const responseCode = [];
    const referenceNo = [];
    const ISOResponseCode = [];
    let totalValue = 0;
    let totalAmount;

    if (receipt.gift) {
        if (!monerisHelper.areAllGiftCardsValid(receipt.gift)) {
            return result;
        }
        receipt.gift.forEach(giftCard => {
            totalAmount = Number(giftCard.benefit_amount);
            totalValue += !isNaN(totalAmount) ? totalAmount : 0;
            transactionNo.push(giftCard.transaction_no);
            referenceNo.push(giftCard.reference_no);
            responseCode.push(giftCard.response_code);
            ISOResponseCode.push(giftCard.iso_response_code);
        });
    }

    let creditCardType = '';
    let cardNumber = '';
    if (receipt.cc) {
        totalAmount = Number(receipt.cc.amount);
        totalValue += !isNaN(totalAmount) ? totalAmount : 0;
        transactionNo.push(receipt.cc.transaction_no);
        referenceNo.push(receipt.cc.reference_no);
        responseCode.push(receipt.cc.response_code);
        transactionCode.push(receipt.cc.transaction_code);
        ISOResponseCode.push(receipt.cc.iso_response_code);
        cardNumber = receipt.cc.first6last4;
        creditCardType = Resource.msg(
            'checkout.monerispayment.creditcard.' + receipt.cc.card_type.toLowerCase(),
            'checkout',
            receipt.cc.card_type
        );
    }

    let currentCustomer = customer;
    if (!currentCustomer && order.customerNo) {
        currentCustomer = CustomerMgr.getCustomerByCustomerNumber(order.customerNo);
    }

    const request = receiptObject.response.request;
    const requestToken = request.token;
    const customerHasToken = requestToken && requestToken.data_key && order.customer.registered;

    if (customerHasToken) {
        const customerPaymentMethods = currentCustomer.profile.wallet.getPaymentInstruments('MONERIS_PAYMENT');
        const paymentMethodsIterator = customerPaymentMethods.iterator();
        let paymentMethod = null;

        while (paymentMethodsIterator.hasNext()) {
            paymentMethod = paymentMethodsIterator.next();
            if (paymentMethod.custom.monerisDataKey === requestToken.data_key &&
                paymentMethod.custom.monerisIssuerId === requestToken.issuer_id) {
                cardNumber = paymentMethod.creditCardNumber;
                creditCardType = paymentMethod.creditCardType;
                break;
            }
        }
    }

    const total = new Money(totalValue, order.getCurrencyCode());
    const orderTotal = order.totalGrossPrice;
    const isFailedTransaction = receipt.result !== monerisHelper.constants.ACCEPTED_KEY;

    Transaction.wrap(() => {
        if (receipt.cc) {
            order.custom.monerisRefundStatus = monerisHelper.constants.REFUND_NOT_SEND;
            order.custom.monerisTransactionNo = transactionNo.join();
            order.custom.monerisReferenceNo = referenceNo.join();
            order.custom.monerisTransactionCode = transactionCode.join();
            order.custom.monerisTransactionType = transactionCode.join();
            order.custom.monerisResponseCode = responseCode.join();
            order.custom.monerisISOResponseCode = ISOResponseCode.join();

            if (order.custom.monerisTransactionCode === monerisHelper.constants.PURCHASE_TRANSACTION_CODE &&
                !isFailedTransaction) {
                if (orderTotal.compareTo(total) === 0) {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                } else {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PARTPAID);
                }
            }

            paymentInstrument.paymentTransaction.transactionID = transactionNo.join();

            const fraud = receipt.cc.fraud;
            const fraudStatusObject = {
                moneris3dsecureStatus: '3d_secure',
                monerisKountStatus: 'kount',
                monerisAVSStatus: 'avs',
                monerisCVDStatus: 'cvd'
            };

            Object.keys(fraudStatusObject).forEach(key => {
                const fraudType = fraud[fraudStatusObject[key]];
                order.custom[key] = fraudType ? fraudType.status : 'disabled';
            });
        }
    });

    if (monerisHelper.isCreditCardValid(receipt.cc)) {
        const paymentTransaction = paymentInstrument.getPaymentTransaction();
        Transaction.wrap(() => {
            paymentTransaction.setAmount(total);
            paymentTransaction.setPaymentProcessor(paymentProcessor);

            const orderPaymentInstrument = paymentTransaction.getPaymentInstrument();
            orderPaymentInstrument.setCreditCardType(creditCardType);
            orderPaymentInstrument.setCreditCardNumber(cardNumber);
        });
    } else {
        result.errorMessage = 'Declined Transaction';
        return result;
    }

    // if transaction is declined, result is returned with error
    if (isFailedTransaction) {
        return result;
    }

    result.error = false;

    if (!order.customer.registered) { // vault_data won't be stored
        return result;
    }

    if (receipt.cc &&
        receipt.cc.tokenize &&
        receipt.cc.tokenize.success) {
        result.token = {
            data_key: receipt.cc.tokenize.datakey,
            issuer_id: receipt.cc.issuer_id,
            creditCardType: creditCardType,
            cardHolder: request.cc.cardholder,
            cardNumber: request.cc.first6last4
        };
    }

    result.vaultData = receiptObject.response.vault_data || null;

    return result;
}

module.exports = {
    Handle: Handle,
    Authorize: Authorize
};
