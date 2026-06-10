import { render } from '@testing-library/react';
import { PersistenceWrapper } from '../components/PersistenceWrapper';
import { FormProvider } from '../contexts/FormContext';

// Mock the hooks
jest.mock('../hooks/useFormPersistence', () => ({
  useFormPersistence: () => ({
    saveFormData: jest.fn(),
    handleSubmit: jest.fn()
  })
}));

const mockConfig = {
  title: 'Test Form',
  description: 'Test Description',
  steps: [
    {
      id: 'step1',
      title: 'Step 1',
      description: 'First step',
      showProgress: true,
      fields: []
    }
  ]
};

const mockContextValue = {
  config: mockConfig,
  currentStep: 0,
  totalSteps: 1,
  currentStepConfig: mockConfig.steps[0],
  isSubmitting: false,
  isCurrentStepValid: true,
  methods: {
    getValues: jest.fn(() => ({})),
    formState: { isValid: true, errors: {} }
  },
  nextStep: jest.fn(),
  prevStep: jest.fn(),
  goToStep: jest.fn(),
  handleFieldChange: jest.fn(),
  handleFieldBlur: jest.fn(),
  validateCurrentStep: jest.fn(),
  handleSubmit: jest.fn(),
  debug: false
};

describe('PersistenceWrapper', () => {
  it('renders without context error', () => {
    render(
      <FormProvider value={mockContextValue}>
        <PersistenceWrapper persistence={{ type: 'localStorage' }}>
          <div>Test Content</div>
        </PersistenceWrapper>
      </FormProvider>
    );

    // If we get here without error, the test passes
    expect(true).toBe(true);
  });
});
