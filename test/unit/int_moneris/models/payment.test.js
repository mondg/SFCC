'use strict';

const { assert } = require('chai');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

Object.setPrototypeOf(module, Object.assign(Object.getPrototypeOf(module), { superModule: { call: () => ({}) } }));

const PaymentModel = proxyquire('../../../../cartridges/int_moneris/cartridge/models/payment', {
    '*/cartridge/scripts/util/collections': { map: (list, callback) => list ? list.map(callback) : [] }
});

const paymentInstruments = [
    {
        creditCardNumberLastDigits: '1111',
        creditCardHolder: 'John Snow',
        creditCardExpirationYear: 2030,
        creditCardType: 'Visa',
        maskedCreditCardNumber: '************1111',
        paymentMethod: 'CREDIT_CARD',
        creditCardExpirationMonth: 1,
        paymentTransaction: {
            amount: {
                value: 10
            }
        }
    },
    {
        giftCertificateCode: 'someString',
        maskedGiftCertificateCode: 'some masked string',
        paymentMethod: 'GIFT_CERTIFICATE',
        paymentTransaction: {
            amount: {
                value: 20
            }
        }
    },
    {
        creditCardType: 'Mastercard',
        creditCardNumberLastDigits: '5454',
        paymentMethod: 'MONERIS_PAYMENT',
        paymentTransaction: {
            amount: {
                value: 30
            }
        }
    },
    {
        creditCardType: 'Amex',
        creditCardNumberLastDigits: '2525',
        paymentMethod: 'TEST_PAYMENT',
        paymentTransaction: {
            amount: {
                value: 40
            }
        }
    }
];

describe('models -> payment', function () {
    it('should properly convert selected payment instruments to simple objects based on their payment method',
        function () {
            const basketMock = { paymentInstruments: paymentInstruments };

            const result = new PaymentModel(basketMock, null);

            assert.equal(result.selectedPaymentInstruments.length, 4);

            assert.equal(result.selectedPaymentInstruments[0].owner, 'John Snow');
            assert.equal(result.selectedPaymentInstruments[0].maskedCreditCardNumber, '************1111');
            assert.equal(result.selectedPaymentInstruments[0].lastFour, '1111');
            assert.equal(result.selectedPaymentInstruments[0].expirationYear, 2030);
            assert.equal(result.selectedPaymentInstruments[0].expirationMonth, 1);
            assert.equal(result.selectedPaymentInstruments[0].type, 'Visa');
            assert.equal(result.selectedPaymentInstruments[0].paymentMethod, 'CREDIT_CARD');
            assert.equal(result.selectedPaymentInstruments[0].amount, 10);

            assert.equal(result.selectedPaymentInstruments[1].giftCertificateCode, 'someString');
            assert.equal(result.selectedPaymentInstruments[1].maskedGiftCertificateCode, 'some masked string');
            assert.equal(result.selectedPaymentInstruments[1].paymentMethod, 'GIFT_CERTIFICATE');
            assert.equal(result.selectedPaymentInstruments[1].amount, 20);

            assert.equal(result.selectedPaymentInstruments[2].creditCardType, 'Mastercard');
            assert.equal(result.selectedPaymentInstruments[2].creditCardNumber, '5454');
            assert.equal(result.selectedPaymentInstruments[2].paymentMethod, 'MONERIS_PAYMENT');
            assert.equal(result.selectedPaymentInstruments[2].amount, 30);

            assert.equal(result.selectedPaymentInstruments[3].paymentMethod, 'TEST_PAYMENT');
            assert.equal(result.selectedPaymentInstruments[3].amount, 40);
        });

    it(`should set 'selectedPaymentInstruments' to null when basket has no payment instruments`,
        function () {
            const basketMock = { paymentInstruments: [] };

            const result = new PaymentModel(basketMock, null);

            assert.isNull(result.selectedPaymentInstruments);
        });
});
