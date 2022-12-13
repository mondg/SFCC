'use strict';

const { assert } = require('chai');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();
const sinon = require('sinon');
const { Resource } = require('../../../../mocks/dw/web');
const { Customer } = require('../../../../mocks/dw/customer');
const { Transaction, Logger } = require('../../../../mocks/dw/system');

describe('scripts -> helpers -> monerisHelper', () => {
    const monerisHelperPath = '../../../../../cartridges/int_moneris/cartridge/scripts/helpers/monerisHelper';

    let dependencies;
    let removePaymentInstrumentSpy;
    let errorSpy;
    let preloadCallSpy;
    let receiptCallSpy;

    const getCustomerAndRegisterSpies = () => {
        const customer = new Customer();
        removePaymentInstrumentSpy = sinon.spy(customer.profile.wallet, 'removePaymentInstrument');
        return customer;
    };

    const getMonerisServiceMockAndRegisterSpies = ({ preloadCallPayload, receiptCallPayload }) => {
        const monerisServiceMock = {
            '*/cartridge/scripts/services/monerisService': {
                preloadCall: () => preloadCallPayload,
                receiptCall: () => receiptCallPayload
            }
        };
        preloadCallSpy = sinon.spy(monerisServiceMock['*/cartridge/scripts/services/monerisService'], 'preloadCall');
        receiptCallSpy = sinon.spy(monerisServiceMock['*/cartridge/scripts/services/monerisService'], 'receiptCall');
        return monerisServiceMock;
    };

    const setPaymentInstruments = (paymentInstruments) => {
        global.customer.profile.wallet.paymentInstruments = paymentInstruments || [];
    };

    before(() => {
        global.empty = value => (value === undefined) || (value === null) || (value.length === 0) || !value;
        global.customer = getCustomerAndRegisterSpies();
        global.session = { privacy: {} };
        dependencies = {
            'dw/order/BasketMgr': {},
            '*/cartridge/scripts/services/monerisService': {},
            'dw/order/OrderMgr': { createOrderNo: () => '12345' },
            'dw/system/System': { getInstanceType: () => 2, PRODUCTION_SYSTEM: 2 },
            'dw/system/Transaction': Transaction,
            'dw/customer/CustomerMgr': {},
            'dw/system/Logger': Logger,
            'dw/system/Site': {
                current: {
                    preferences: {
                        custom: {
                            monerisStoreId: 'store123',
                            monerisApiToken: 'token123',
                            monerisCheckoutId: 'checkout123',
                            monerisDynamicDescriptor: 'descriptor123',
                            monerisAskCVV: 'cvv123',
                            monerisLng: { value: 'en_CA' }
                        }
                    }
                }
            }
        };

        errorSpy = sinon.spy(Logger, 'error');
    });

    afterEach(() => {
        global.customer = getCustomerAndRegisterSpies();
        global.session = { privacy: {} };
        errorSpy.reset();
    });

    describe('getTicket', () => {
        it('should return null when current basket does not exist', () => {
            const BasketMgrMock = { 'dw/order/BasketMgr': { getCurrentBasket: () => null } };
            const monerisHelper = proxyquire(monerisHelperPath, { ...dependencies, ...BasketMgrMock });

            const result = monerisHelper.getTicket();

            assert.isNull(result);
            assert.isUndefined(global.session.privacy.orderNo);
            assert.isUndefined(global.session.privacy.ticketId);
        });

        it('should return ticket when current basket exists and service responds with success', () => {
            const BasketMgrMock = { 'dw/order/BasketMgr': { getCurrentBasket: () => ({ test: '' }) } };
            const preloadCallPayload = {
                object: { response: { success: true, ticket: 'abc123' } },
                ok: true
            };
            const monerisServiceMock = getMonerisServiceMockAndRegisterSpies({ preloadCallPayload });
            const monerisHelper = proxyquire(monerisHelperPath,
                { ...dependencies, ...BasketMgrMock, ...monerisServiceMock });

            const result = monerisHelper.getTicket();

            assert.equal(result, 'abc123');
            assert.equal(global.session.privacy.orderNo, '12345');
            assert.equal(global.session.privacy.ticketId, 'abc123');
        });

        it('should build payload with token when customer is authenticated', () => {
            global.customer.authenticated = true;
            setPaymentInstruments([{
                paymentMethod: 'MONERIS_PAYMENT',
                custom: {
                    monerisDataKey: 'datakey123',
                    monerisIssuerId: 'issuerId'
                }
            }]);
            const BasketMgrMock = { 'dw/order/BasketMgr': { getCurrentBasket: () => ({ test: '' }) } };
            const preloadCallPayload = {
                object: { response: { success: true, ticket: 'abc123' } },
                ok: true
            };
            const monerisServiceMock = getMonerisServiceMockAndRegisterSpies({ preloadCallPayload });
            const monerisHelper = proxyquire(monerisHelperPath,
                { ...dependencies, ...BasketMgrMock, ...monerisServiceMock });
            const expectedPayload = {
                lineItemCtnr: { test: '' },
                orderNo: '12345',
                instanceType: 'prod',
                store_id: 'store123',
                api_token: 'token123',
                checkout_id: 'checkout123',
                ask_cvv: 'cvv123',
                dynamic_descriptor: 'descriptor123',
                language: 'en_CA',
                token: [
                    {
                        data_key: 'datakey123',
                        issuer_id: 'issuerId'
                    }
                ]
            };

            monerisHelper.getTicket();

            const actualPayload = preloadCallSpy.args[0][0];
            assert.deepEqual(actualPayload, expectedPayload);
        });

        it('should build payload without token when customer is not authenticated', () => {
            global.customer.authenticated = false;
            const BasketMgrMock = { 'dw/order/BasketMgr': { getCurrentBasket: () => ({ test: '' }) } };
            const preloadCallPayload = {
                object: { response: { success: true, ticket: 'abc123' } },
                ok: true
            };
            const monerisServiceMock = getMonerisServiceMockAndRegisterSpies({ preloadCallPayload });
            const monerisHelper = proxyquire(monerisHelperPath,
                { ...dependencies, ...BasketMgrMock, ...monerisServiceMock });

            const expectedPayload = {
                lineItemCtnr: { test: '' },
                orderNo: '12345',
                instanceType: 'prod',
                store_id: 'store123',
                api_token: 'token123',
                checkout_id: 'checkout123',
                ask_cvv: 'cvv123',
                dynamic_descriptor: 'descriptor123',
                language: 'en_CA'
            };

            monerisHelper.getTicket();

            const actualPayload = preloadCallSpy.args[0][0];
            assert.deepEqual(actualPayload, expectedPayload);
        });

        it('should log error message when service responds with duplication error', () => {
            const BasketMgrMock = { 'dw/order/BasketMgr': { getCurrentBasket: () => ({ test: '' }) } };
            const preloadCallPayload = {
                object: { response: { error: { order_no: 'Duplicate orderId' } } }
            };
            const monerisServiceMock = getMonerisServiceMockAndRegisterSpies({ preloadCallPayload });
            const monerisHelper = proxyquire(monerisHelperPath,
                { ...dependencies, ...BasketMgrMock, ...monerisServiceMock });

            monerisHelper.getTicket();

            const [errorMessageTemplate, error, orderNo] = errorSpy.args[0];
            assert.isTrue(errorSpy.calledOnce);
            assert.equal(errorMessageTemplate, '{0} in order with id: {1}');
            assert.equal(error, 'Duplicate orderId');
            assert.equal(orderNo, '12345');
        });

        it(`should return null when serviceResult does not contain field 'object'`, () => {
            const BasketMgrMock = { 'dw/order/BasketMgr': { getCurrentBasket: () => ({ test: '' }) } };
            const preloadCallPayload = { ok: false };
            const monerisServiceMock = getMonerisServiceMockAndRegisterSpies({ preloadCallPayload });
            const monerisHelper = proxyquire(monerisHelperPath,
                { ...dependencies, ...BasketMgrMock, ...monerisServiceMock });

            const result = monerisHelper.getTicket();

            assert.isNull(result);
        });
    });

    describe('getReceipt', () => {
        it('should build proper payload for monerisService.receiptCall and return its response when ticket is passed',
            () => {
                const receiptCallPayload = { ok: true, status: 'success' };
                const monerisServiceMock = getMonerisServiceMockAndRegisterSpies({ receiptCallPayload });
                const monerisHelper = proxyquire(monerisHelperPath, { ...dependencies, ...monerisServiceMock });
                const expectedParams = {
                    instanceType: 'prod',
                    store_id: 'store123',
                    api_token: 'token123',
                    checkout_id: 'checkout123',
                    dynamic_descriptor: 'descriptor123',
                    ticket: 'abc123'
                };
                const expectedResponse = { ok: true, status: 'success' };

                const result = monerisHelper.getReceipt('abc123');

                const actualParams = receiptCallSpy.args[0][0];
                assert.isTrue(receiptCallSpy.calledOnce);
                assert.deepEqual(actualParams, expectedParams);
                assert.deepEqual(result, expectedResponse);
            });
    });

    describe('getInstanceType', () => {
        it(`should return 'prod' when instance type is production`, () => {
            const monerisHelper = proxyquire(monerisHelperPath,
                { 'dw/system/System': { getInstanceType: () => 2, PRODUCTION_SYSTEM: 2 } });

            const result = monerisHelper.getInstanceType();

            assert.equal(result, 'prod');
        });

        it(`should return 'qa' when instance type is staging`, () => {
            const monerisHelper = proxyquire(monerisHelperPath,
                { 'dw/system/System': { getInstanceType: () => 1, PRODUCTION_SYSTEM: 2 } });

            const result = monerisHelper.getInstanceType();

            assert.equal(result, 'qa');
        });

        it(`should return 'qa' when instance type is development`, () => {
            const monerisHelper = proxyquire(monerisHelperPath,
                { 'dw/system/System': { getInstanceType: () => 0, PRODUCTION_SYSTEM: 2 } });

            const result = monerisHelper.getInstanceType();

            assert.equal(result, 'qa');
        });
    });

    describe('areAllGiftCardsValid', () => {
        const monerisHelper = require(monerisHelperPath);

        it(`should return 'true' when all gift card response codes do not exceed success threshold`, () => {
            const giftCardMocks = [{ response_code: '49' }, { response_code: '40' }, { response_code: '45' }, { response_code: '42' }];

            const result = monerisHelper.areAllGiftCardsValid(giftCardMocks);

            assert.isTrue(result);
        });

        it(`should return 'false' when some gift card response codes equals or exceed success threshold`, () => {
            const giftCardMocks = [{ response_code: '50' }, { response_code: '40' }, { response_code: '45' }, { response_code: '58' }];

            const result = monerisHelper.areAllGiftCardsValid(giftCardMocks);

            assert.isFalse(result);
        });

        it(`should return 'false' when all gift card response codes exceed success threshold`, () => {
            const giftCardMocks = [{ response_code: '51' }, { response_code: '60' }, { response_code: '55' }, { response_code: '58' }];

            const result = monerisHelper.areAllGiftCardsValid(giftCardMocks);

            assert.isFalse(result);
        });
    });

    describe('isCreditCardValid', () => {
        const monerisHelper = require(monerisHelperPath);

        it(`should return 'true' when credit card is accepted and response code is less than success threshold`, () => {
            const creditCardMock = { result: 'a', response_code: '45' };

            const result = monerisHelper.isCreditCardValid(creditCardMock);

            assert.isTrue(result);
        });

        it(`should return 'false' when credit card is accepted and response code exceeds success threshold`, () => {
            const creditCardMock = { result: 'a', response_code: '55' };

            const result = monerisHelper.isCreditCardValid(creditCardMock);

            assert.isFalse(result);
        });

        it(`should return 'false' when credit card is accepted and response code equals success threshold`, () => {
            const creditCardMock = { result: 'a', response_code: '50' };

            const result = monerisHelper.isCreditCardValid(creditCardMock);

            assert.isFalse(result);
        });

        it(`should return 'false' when credit card is not accepted and response code is less than success threshold`,
            () => {
                const creditCardMock = { result: 'd', response_code: '40' };

                const result = monerisHelper.isCreditCardValid(creditCardMock);

                assert.isFalse(result);
            });

        it(`should return 'false' when credit card is not accepted and response code exceeds success threshold`, () => {
            const creditCardMock = { result: 'd', response_code: '60' };

            const result = monerisHelper.isCreditCardValid(creditCardMock);

            assert.isFalse(result);
        });
    });

    describe('savePaymentToken', () => {
        it('should return false when order does not have associated customer', () => {
            const monerisHelper = proxyquire(monerisHelperPath, dependencies);
            const tokenMock = { data_key: 'datakey123', issuer_id: 'abc123' };
            const orderMock = {};

            const result = monerisHelper.savePaymentToken(tokenMock, orderMock);

            assert.isFalse(result);
        });

        it('should return false when associated with order customer is not registered', () => {
            const monerisHelper = proxyquire(monerisHelperPath, dependencies);
            const tokenMock = { data_key: 'datakey123', issuer_id: 'abc123' };
            const orderMock = { customer: { registered: false } };

            const result = monerisHelper.savePaymentToken(tokenMock, orderMock);

            assert.isFalse(result);
        });

        it('should return false when token does not have data key', () => {
            const monerisHelper = proxyquire(monerisHelperPath, dependencies);
            const tokenMock = { issuer_id: 'abc123' };
            const orderMock = { customer: { registered: true } };

            const result = monerisHelper.savePaymentToken(tokenMock, orderMock);

            assert.isFalse(result);
        });

        it('should get customer via CustomerMgr when there is no customer associated with current request',
            () => {
                const customer = global.customer;
                global.customer = null;
                const CustomerMgrMock = { 'dw/customer/CustomerMgr': { getCustomerByCustomerNumber: () => customer } };
                const getCustomerByCustomerNumberSpy = sinon.spy(CustomerMgrMock['dw/customer/CustomerMgr'],
                    'getCustomerByCustomerNumber');
                const monerisHelper = proxyquire(monerisHelperPath, { ...dependencies, ...CustomerMgrMock });
                const tokenMock = { data_key: 'datakey123', issuer_id: 'abc123' };
                const orderMock = { customer: { registered: true }, customerNo: 'abc456' };

                monerisHelper.savePaymentToken(tokenMock, orderMock);

                const customerNo = getCustomerByCustomerNumberSpy.args[0][0];
                assert.isTrue(getCustomerByCustomerNumberSpy.calledOnce);
                assert.equal(customerNo, 'abc456');
            });

        it('should save new payment token and remove oldest saved one when stored payment token number exceeds 3',
            () => {
                setPaymentInstruments([
                    { creationDate: 30 },
                    { creationDate: 10 },
                    { creationDate: 20 }
                ]);
                const monerisHelper = proxyquire(monerisHelperPath, dependencies);
                const tokenMock = {
                    data_key: 'datakey123',
                    issuer_id: 'abc123',
                    creditCardType: 'Visa',
                    cardHolder: 'John Snow',
                    cardNumber: '4141202030304040'
                };
                const orderMock = { customer: { registered: true }, customerNo: 'abc456' };

                const result = monerisHelper.savePaymentToken(tokenMock, orderMock);

                assert.isTrue(result);
                const savedPaymentInstrument = global.customer.profile.wallet.paymentInstruments[0];
                assert.equal(savedPaymentInstrument.custom.monerisDataKey, 'datakey123');
                assert.equal(savedPaymentInstrument.custom.monerisIssuerId, 'abc123');
                assert.equal(savedPaymentInstrument.creditCardType, 'Visa');
                assert.equal(savedPaymentInstrument.creditCardHolder, 'John Snow');
                assert.equal(savedPaymentInstrument.creditCardNumber, '4141202030304040');
                const paymentInstrumentToBeRemoved = removePaymentInstrumentSpy.args[0][0];
                assert.deepEqual(paymentInstrumentToBeRemoved, { creationDate: 10 });
            });
    });

    describe('removeInvalidTokens', () => {
        it('should return false when order does not have associated customer', () => {
            const monerisHelper = proxyquire(monerisHelperPath, dependencies);
            const vaultData = [];
            const order = {};

            const result = monerisHelper.removeInvalidPaymentTokens(vaultData, order);

            assert.isFalse(result);
        });

        it('should return false when associated with order customer is not registered', () => {
            const monerisHelper = proxyquire(monerisHelperPath, dependencies);
            const vaultData = [];
            const order = { customer: { registered: false } };

            const result = monerisHelper.removeInvalidPaymentTokens(vaultData, order);

            assert.isFalse(result);
        });

        it('should return false when vault data is not provided', () => {
            const monerisHelper = proxyquire(monerisHelperPath, dependencies);
            const vaultData = null;
            const order = { customer: { registered: true } };

            const result = monerisHelper.removeInvalidPaymentTokens(vaultData, order);

            assert.isFalse(result);
        });

        it('should get customer via CustomerMgr when there is no customer associated with current request',
            () => {
                const customer = global.customer;
                global.customer = null;
                const CustomerMgrMock = { 'dw/customer/CustomerMgr': { getCustomerByCustomerNumber: () => customer } };
                const getCustomerByCustomerNumberSpy = sinon.spy(CustomerMgrMock['dw/customer/CustomerMgr'],
                    'getCustomerByCustomerNumber');
                const monerisHelper = proxyquire(monerisHelperPath, { ...dependencies, ...CustomerMgrMock });
                const vaultData = [];
                const order = { customer: { registered: true }, customerNo: 'abc123' };

                monerisHelper.removeInvalidPaymentTokens(vaultData, order);

                const customerNo = getCustomerByCustomerNumberSpy.args[0][0];
                assert.isTrue(getCustomerByCustomerNumberSpy.calledOnce);
                assert.equal(customerNo, 'abc123');
            });

        it('should remove payment token when there is no data about this token in vault data',
            () => {
                setPaymentInstruments([{
                    paymentMethod: 'MONERIS_PAYMENT',
                    custom: {
                        monerisDataKey: 'datakey123',
                        monerisIssuerId: 'issuerId'
                    }
                }]);
                const monerisHelper = proxyquire(monerisHelperPath, dependencies);
                const vaultData = [];
                const order = { customer: { registered: true }, customerNo: 'abc123' };
                const expectedPayload = {
                    paymentMethod: 'MONERIS_PAYMENT',
                    custom: {
                        monerisDataKey: 'datakey123',
                        monerisIssuerId: 'issuerId'
                    }
                };

                const result = monerisHelper.removeInvalidPaymentTokens(vaultData, order);

                assert.isTrue(result);
                const paymentInstrumentToBeRemoved = removePaymentInstrumentSpy.args[0][0];
                assert.isTrue(removePaymentInstrumentSpy.calledOnce);
                assert.deepEqual(paymentInstrumentToBeRemoved, expectedPayload);
            });

        it('should remove payment token when it is invalid according to vault data',
            () => {
                setPaymentInstruments([{
                    paymentMethod: 'MONERIS_PAYMENT',
                    custom: {
                        monerisDataKey: 'datakey123',
                        monerisIssuerId: 'issuerId'
                    }
                }]);
                const monerisHelper = proxyquire(monerisHelperPath, dependencies);
                const vaultData = [{ data_key: 'datakey123', is_valid: false }];
                const order = { customer: { registered: true }, customerNo: 'abc123' };
                const expectedPayload = {
                    paymentMethod: 'MONERIS_PAYMENT',
                    custom: {
                        monerisDataKey: 'datakey123',
                        monerisIssuerId: 'issuerId'
                    }
                };

                const result = monerisHelper.removeInvalidPaymentTokens(vaultData, order);

                assert.isTrue(result);
                const actualPayload = removePaymentInstrumentSpy.args[0][0];
                assert.isTrue(removePaymentInstrumentSpy.calledOnce);
                assert.deepEqual(actualPayload, expectedPayload);
            });

        it('should not remove payment token when it is valid according to vault data',
            () => {
                setPaymentInstruments([{
                    paymentMethod: 'MONERIS_PAYMENT',
                    custom: {
                        monerisDataKey: 'datakey123',
                        monerisIssuerId: 'issuerId'
                    }
                }]);
                const monerisHelper = proxyquire(monerisHelperPath, dependencies);
                const vaultData = [{ data_key: 'datakey123', is_valid: true }];
                const order = { customer: { registered: true }, customerNo: 'abc123' };

                const result = monerisHelper.removeInvalidPaymentTokens(vaultData, order);

                assert.isFalse(result);
                assert.isTrue(removePaymentInstrumentSpy.notCalled);
            });
    });

    describe('getFailReason', () => {
        const monerisHelper = proxyquire(monerisHelperPath, { 'dw/web/Resource': new Resource(), 'dw/order/Order': { ORDER_STATUS_FAILED: 8 } });

        it('should return proper fail reason when payment transaction is cancelled', () => {
            const order = {
                custom: {
                    cancelledOrder: true
                }
            };

            const result = monerisHelper.getFailReason(order);

            assert.equal(result, 'Payment transaction cancelled');
        });

        it('should return proper fail reason when payment transaction is not completed (case 1)', () => {
            const order = {
                custom: {
                    monerisResponseCode: '113',
                    monerisISOResponseCode: '68'
                }
            };

            const result = monerisHelper.getFailReason(order);

            assert.equal(result, 'Payment transaction not complete');
        });

        it('should return proper fail reason when payment transaction is not completed (case 2)', () => {
            const order = {
                custom: {
                    monerisResponseCode: '113',
                    monerisISOResponseCode: '96'
                }
            };

            const result = monerisHelper.getFailReason(order);

            assert.equal(result, 'Payment transaction not complete');
        });

        it('should return proper fail reason when payment transaction is not completed (case 3)', () => {
            const order = {
                custom: {
                    monerisResponseCode: '',
                    monerisISOResponseCode: ''
                },
                status: 8
            };

            const result = monerisHelper.getFailReason(order);

            assert.equal(result, 'Payment transaction not complete');
        });

        it('should return empty string when payment transaction is not approved', () => {
            const order = {
                custom: {
                    monerisResponseCode: '150'
                }
            };

            const result = monerisHelper.getFailReason(order);

            assert.equal(result, 'Payment transaction not approved');
        });

        it('Should return empty string when payment transaction data does not match any of error conditions', () => {
            const order = {
                custom: {
                    monerisResponseCode: '',
                    monerisISOResponseCode: ''
                },
                status: 2
            };

            const result = monerisHelper.getFailReason(order);

            assert.equal(result, '');
        });
    });
});
