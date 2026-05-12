// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOnboardingForm } from './index';

// Minimal zodResolver mock so useForm doesn't need the full schema infrastructure
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async () => ({ values: {}, errors: {} }),
}));

vi.mock('../schemas/onboardingValidation', () => ({
  onboardingFormSchema: {},
  createOnboardingSchemaWithClassification: () => ({}),
}));

describe('useOnboardingForm — Kinde pre-fill', () => {
  it('sets firstName and lastName from kindeUser.givenName / familyName in defaultValues', () => {
    const kindeUser = {
      givenName: 'Dinesh',
      familyName: 'Chinta',
      email: 'dinesh@example.com',
    };

    const { result } = renderHook(() =>
      useOnboardingForm('newBusiness', undefined, kindeUser)
    );

    const values = result.current.getValues();
    expect(values.firstName).toBe('Dinesh');
    expect(values.lastName).toBe('Chinta');
    expect((values as Record<string, unknown>).adminEmail).toBe('dinesh@example.com');
  });

  it('leaves name fields empty when kindeUser is null', () => {
    const { result } = renderHook(() =>
      useOnboardingForm('newBusiness', undefined, null)
    );

    const values = result.current.getValues();
    expect(values.firstName).toBe('');
    expect(values.lastName).toBe('');
  });

  it('uses empty string fallback when given/family name is missing from kindeUser', () => {
    const kindeUser = { email: 'test@example.com' };

    const { result } = renderHook(() =>
      useOnboardingForm('newBusiness', undefined, kindeUser)
    );

    const values = result.current.getValues();
    expect(values.firstName).toBe('');
    expect(values.lastName).toBe('');
  });
});
