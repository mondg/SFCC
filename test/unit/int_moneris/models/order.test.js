'use strict';

const { assert } = require('chai');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

Object.setPrototypeOf(module, Object.assign(Object.getPrototypeOf(module), { superModule: { call: () => ({}) } }));

const OrderModel = proxyquire('../../../../cartridges/int_moneris/cartridge/models/order', {
    '*/cartridge/scripts/helpers/monerisHelper': {
        getInstanceType: () => 'prod',
        getFailReason: () => 'some fail reason'
    }
});

describe('models -> order', () => {
    it(`should set proper attributes to model when containerView equals 'order' and lineItemCtnr's first payment instrument payment method equals 'MONERIS_PAYMENT'`, () => {
        const lineItemCtnr = {
            custom: { monerisTicket: 'abc123' },
            paymentInstruments: [{ paymentMethod: 'MONERIS_PAYMENT' }]
        };
        const options = { containerView: 'order' };

        const result = new OrderModel(lineItemCtnr, options);

        assert.equal(result.ticket, 'abc123');
        assert.equal(result.instance, 'prod');
        assert.equal(result.failReason, 'some fail reason');
    });

    it(`should set proper attributes to model when containerView equals 'order' and lineItemCtnr's first payment instrument payment method does not equal 'MONERIS_PAYMENT'`, () => {
        const lineItemCtnr = {
            custom: { monerisTicket: 'abc123' },
            paymentInstruments: []
        };
        const options = { containerView: 'order' };

        const result = new OrderModel(lineItemCtnr, options);

        assert.equal(result.ticket, 'abc123');
        assert.equal(result.instance, 'prod');
        assert.equal(result.failReason, '');
    });

    it('should not set any attributes to model when lineItemCtnr does not exist', () => {
        const options = { containerView: 'order' };

        const result = new OrderModel(null, options);

        assert.isUndefined(result.ticket);
        assert.isUndefined(result.instance);
        assert.isUndefined(result.failReason);
    });

    it(`should not set any attributes to model when containerView does not equal 'order'`, () => {
        const lineItemCtnr = {
            custom: { monerisTicket: 'abc123' },
            paymentInstruments: [{ paymentMethod: 'MONERIS_PAYMENT' }]
        };
        const options = { containerView: 'basket' };

        const result = new OrderModel(lineItemCtnr, options);

        assert.isUndefined(result.ticket);
        assert.isUndefined(result.instance);
        assert.isUndefined(result.failReason);
    });
});
