'use strict';

const { assert } = require('chai');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const sinon = require('sinon');
const { Transaction } = require('../../../../mocks/dw/system');
const OrderMgr = {
    createOrder: (currentBasket, orderNo = '0000001') => ({
        orderNo,
        orderToken: 'some secure order token'
    }),
    failOrder: () => {
        return {};
    }
};

Object.setPrototypeOf(module, Object.assign(Object.getPrototypeOf(module), { superModule: {} }));

describe('scripts -> checkout -> checkoutHelpers', () => {
    const checkoutHelpersPath = '../../../../../cartridges/int_moneris/cartridge/scripts/checkout/checkoutHelpers';
    const dependencies = {
        'dw/order/PaymentMgr': { getPaymentMethod: () => ({ paymentProcessor: { ID: 'MONERIS_PAYMENT' } }) },
        'dw/system/HookMgr': {},
        'dw/order/OrderMgr': OrderMgr,
        'dw/system/Transaction': Transaction
    };

    describe('createOrder', () => {
        beforeEach(() => {
            global.session = { privacy: {} };
        });

        it(`should set 'orderToken' to session privacy object and return created order when order is successfully created from basket`,
            () => {
                const checkoutHelpers = proxyquire(checkoutHelpersPath, dependencies);
                const basketMock = {};

                const result = checkoutHelpers.createOrder(basketMock);

                assert.equal(global.session.privacy.orderToken, result.orderToken);
                assert.equal(result.orderNo, '0000001');
            });

        it(`should set 'orderToken' to session privacy object and return created order when order is successfully created from basket and order number`,
            () => {
                const checkoutHelpers = proxyquire(checkoutHelpersPath, dependencies);
                const basketMock = {};
                const orderNo = 'order123';

                const result = checkoutHelpers.createOrder(basketMock, orderNo);

                assert.equal(global.session.privacy.orderToken, result.orderToken);
                assert.equal(result.orderNo, 'order123');
            });

        it('should return null when error is thrown during order creation', () => {
            const OrderMgrMock = {
                'dw/order/OrderMgr': {
                    createOrder: () => {
                        throw new Error();
                    }
                }
            };
            const checkoutHelpers = proxyquire(checkoutHelpersPath, { ...dependencies, ...OrderMgrMock });
            const basketMock = {};

            const result = checkoutHelpers.createOrder(basketMock);

            assert.isUndefined(global.session.privacy.orderToken);
            assert.isNull(result);
        });
    });

    describe('handlePayments', () => {
        let failOrderSpy;

        before(() => {
            failOrderSpy = sinon.spy(OrderMgr, 'failOrder');
        });

        afterEach(() => {
            failOrderSpy.reset();
        });

        it(`should return empty object when order 'totalNetPrice' equals 0`, () => {
            const checkoutHelpers = proxyquire(checkoutHelpersPath, dependencies);
            const orderMock = { totalNetPrice: 0.00 };
            const orderNumber = 'order123';

            const result = checkoutHelpers.handlePayments(orderMock, orderNumber);

            assert.deepEqual(result, {});
        });

        it('should fail order and return object with error when order does not have payment instruments', () => {
            const checkoutHelpers = proxyquire(checkoutHelpersPath, dependencies);
            const orderMock = { totalNetPrice: 95.00, paymentInstruments: [] };
            const orderNumber = 'order123';

            const result = checkoutHelpers.handlePayments(orderMock, orderNumber);

            assert.isTrue(failOrderSpy.calledOnce);
            assert.deepEqual(failOrderSpy.args[0][0], orderMock);
            assert.isTrue(result.error);
        });

        it(`should set order number as 'transactionID' to payment instrument payment transaction when payment processor is null`,
            () => {
                const PaymentMgrMock = { 'dw/order/PaymentMgr': { getPaymentMethod: () => ({ paymentProcessor: null }) } };
                const checkoutHelpers = proxyquire(checkoutHelpersPath, { ...dependencies, ...PaymentMgrMock });
                const orderMock = {
                    totalNetPrice: 95.00,
                    paymentInstruments: [
                        {
                            paymentMethod: 'MONERIS_PAYMENT',
                            paymentTransaction: {
                                setTransactionID: function (transactionID) {
                                    this.transactionID = transactionID;
                                }
                            }
                        }
                    ]
                };
                const orderNumber = 'order123';

                checkoutHelpers.handlePayments(orderMock, orderNumber);

                assert.equal(orderMock.paymentInstruments[0].paymentTransaction.transactionID, orderNumber);
            });

        it(`should call Moneris payment processor hook and return object with response information when payment processor ID equals 'MONERIS_PAYMENT' and Moneris service responds with success`,
            () => {
                const PaymentMgrMock = { 'dw/order/PaymentMgr': { getPaymentMethod: id => ({ paymentProcessor: { ID: id } }) } };
                const HookMgrMock = {
                    'dw/system/HookMgr': {
                        callHook: () => ({ token: 'abc123', vaultData: { data: 'some test data' } }),
                        hasHook: () => true
                    }
                };
                const callHookSpy = sinon.spy(HookMgrMock['dw/system/HookMgr'], 'callHook');
                const checkoutHelpers = proxyquire(
                    checkoutHelpersPath,
                    { ...dependencies, ...PaymentMgrMock, ...HookMgrMock });
                const orderMock = {
                    totalNetPrice: 95.00,
                    paymentInstruments: [{ paymentMethod: 'Visa' }, { paymentMethod: 'MONERIS_PAYMENT' }]
                };
                const orderNumber = 'order123';

                const result = checkoutHelpers.handlePayments(orderMock, orderNumber);
                const [hookName, functionName, orderNo, paymentInstrument, paymentProcessor] = callHookSpy.args[1];

                assert.equal(hookName, 'app.payment.processor.moneris_payment');
                assert.equal(functionName, 'Authorize');
                assert.equal(orderNo, orderNumber);
                assert.deepEqual(paymentInstrument, { paymentMethod: 'MONERIS_PAYMENT' });
                assert.deepEqual(paymentProcessor, { ID: 'MONERIS_PAYMENT' });

                assert.equal(result.token, 'abc123');
                assert.deepEqual(result.vaultData, { data: 'some test data' });
            });

        it(`should return empty object when no payment processor payment method equals 'MONERIS_PAYMENT'`,
            () => {
                const PaymentMgrMock = { 'dw/order/PaymentMgr': { getPaymentMethod: () => ({ paymentProcessor: { ID: 'CREDIT_CARD' } }) } };
                const HookMgrMock = { 'dw/system/HookMgr': { callHook: () => ({}), hasHook: () => false } };
                const checkoutHelpers = proxyquire(checkoutHelpersPath,
                    { ...dependencies, ...PaymentMgrMock, ...HookMgrMock });
                const orderMock = {
                    totalNetPrice: 95.00,
                    paymentInstruments: [{ paymentMethod: 'Visa' }, { paymentMethod: 'Mastercard' }]
                };
                const orderNumber = 'order123';

                const result = checkoutHelpers.handlePayments(orderMock, orderNumber);

                assert.deepEqual(result, {});
            });

        it('should fail order and return object with error information when Moneris service responds with error',
            () => {
                const PaymentMgrMock = { 'dw/order/PaymentMgr': { getPaymentMethod: () => ({ paymentProcessor: { ID: 'MONERIS_PAYMENT' } }) } };
                const HookMgrMock = { 'dw/system/HookMgr': { callHook: () => ({ error: true }), hasHook: () => true } };
                const checkoutHelpers = proxyquire(checkoutHelpersPath,
                    { ...dependencies, ...PaymentMgrMock, ...HookMgrMock });
                const orderMock = {
                    totalNetPrice: 95.00,
                    paymentInstruments: [{ paymentMethod: 'MONERIS_PAYMENT' }]
                };
                const orderNumber = 'order123';

                const result = checkoutHelpers.handlePayments(orderMock, orderNumber);

                assert.isTrue(failOrderSpy.calledOnce);
                assert.isTrue(result.error);
                assert.equal(result.errorMessage, 'Authorization Error');
                assert.isTrue(result.isAuthorizationError);
            });

        it(`should skip order failing when Moneris service responds with error and 'skipOrder' is set to truthy value`,
            () => {
                const PaymentMgrMock = { 'dw/order/PaymentMgr': { getPaymentMethod: () => ({ paymentProcessor: { ID: 'MONERIS_PAYMENT' } }) } };
                const HookMgrMock = {
                    'dw/system/HookMgr': {
                        callHook: () => ({ error: true, skipOrder: true }),
                        hasHook: () => true
                    }
                };
                const checkoutHelpers = proxyquire(checkoutHelpersPath,
                    { ...dependencies, ...PaymentMgrMock, ...HookMgrMock });
                const orderMock = {
                    totalNetPrice: 95.00,
                    paymentInstruments: [{ paymentMethod: 'MONERIS_PAYMENT' }]
                };
                const orderNumber = 'order123';

                const result = checkoutHelpers.handlePayments(orderMock, orderNumber);

                assert.isTrue(result.error);
                assert.equal(result.errorMessage, 'Authorization Error');
                assert.isTrue(result.isAuthorizationError);
            });
    });
});
