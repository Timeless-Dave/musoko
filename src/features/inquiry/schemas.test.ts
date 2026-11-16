import { describe, expect, it } from 'vitest';
import { OTHER_LISTING, toRequest, validate, type FormContext, type InquiryFormValues } from './schemas';

const ctx: FormContext = {
  farmerProfileId: 'farm-01', communityId: 'com-helena', unit: 'bunch', listingRequired: true, optionRequired: true,
};
const values: InquiryFormValues = {
  listing: 'prod-001', pickupOptionId: 'option-01', quantity: '3', replyChannel: 'text',
  name: 'Renata Voss', phone: '870-555-0171', email: '', message: '', website: '',
};

describe('toRequest', () => {
  it('turns typed text into a request', () => {
    expect(toRequest(values, ctx)).toEqual({
      farmerProfileId: 'farm-01', productId: 'prod-001', pickupOptionId: 'option-01', communityId: 'com-helena',
      requestedQuantity: { amount: 3, unit: 'bunch' }, replyChannel: 'text', name: 'Renata Voss',
      phone: '870-555-0171', email: null, message: '',
    });
  });
  it('reads a comma as a decimal point and an empty box as no quantity', () => {
    expect(toRequest({ ...values, quantity: '2,5' }, ctx).requestedQuantity).toEqual({ amount: 2.5, unit: 'bunch' });
    expect(toRequest({ ...values, quantity: '  ' }, ctx).requestedQuantity).toBeNull();
  });
  it('sends no product, and no quantity, for "something else"', () => {
    const request = toRequest({ ...values, listing: OTHER_LISTING }, { ...ctx, unit: null });
    expect(request.productId).toBeNull();
    expect(request.requestedQuantity).toBeNull();
  });
});

describe('validate', () => {
  it('passes a complete form', () => {
    expect(validate(values, ctx, [1, 2])).toEqual({});
  });
  it('checks only the steps asked for', () => {
    const empty = { ...values, name: '', phone: '' };
    expect(validate(empty, ctx, [1])).toEqual({});
    expect(validate(empty, ctx, [2])).toEqual({ name: 'name_required', phone: 'phone_required' });
  });
  it('asks for a listing and a pickup choice when the farm offers them', () => {
    expect(validate({ ...values, listing: '', pickupOptionId: '' }, ctx, [1])).toEqual({
      listing: 'listing_required', pickupOptionId: 'option_required',
    });
    expect(validate({ ...values, listing: '', pickupOptionId: '' }, { ...ctx, listingRequired: false, optionRequired: false }, [1])).toEqual({});
  });
  it('puts a bad quantity beside the quantity box', () => {
    expect(validate({ ...values, quantity: 'lots' }, ctx, [1])).toEqual({ quantity: 'quantity_invalid' });
    expect(validate({ ...values, quantity: '0' }, ctx, [1])).toEqual({ quantity: 'quantity_invalid' });
  });
  it('wants the email when the answer comes by email', () => {
    expect(validate({ ...values, replyChannel: 'email', phone: '' }, ctx, [2])).toEqual({ email: 'email_required' });
  });
});
