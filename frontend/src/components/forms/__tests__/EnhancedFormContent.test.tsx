import { render, screen } from '@testing-library/react';
import { EnhancedFormContent } from '../components/EnhancedFormContent';
import { FormProvider } from '../contexts/FormContext';

// Mock react-hook-form
jest.mock('react-hook-form', () => ({
  useForm: jest.fn(() => ({
    getValues: jest.fn(() => ({})),
    setValue: jest.fn(),
    trigger: jest.fn(),
    handleSubmit: jest.fn(),
    formState: {
      isValid: true,
      errors: {},
      isDirty: false,
      isSubmitting: false
    },
    watch: jest.fn(() => ({}))
  }))
}));

// Mock the hooks
jest.mock('../hooks/useFormAccessibility', () => ({
  useFormAccessibility: () => ({
    focusFirstField: jest.fn()
  })
}));

jest.mock('../hooks/useFormPersistence', () => ({
  useFormPersistence: () => ({
    saveFormData: jest.fn(),
    handleSubmit: jest.fn()
  })
}));

jest.mock('../hooks/useFormPerformance', () => ({
  useFormPerformance: () => ({
    formValues: {},
    validationState: { isValid: true }
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
      fields: [
        {
          id: 'testField',
          label: 'Test Field',
          type: 'text',
          required: true
        }
      ]
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

describe('EnhancedFormContent', () => {
  it('renders without context error', () => {
    const renderField = jest.fn(() => <div>Test Field</div>);
    
    render(
      <FormProvider value={mockContextValue}>
        <EnhancedFormContent
          animations={true}
          accessibility={true}
          persistence={{}}
          debug={false}
          currentStep={0}
          transitionDirection="none"
          renderField={renderField}
          currentStepConfig={mockConfig.steps[0]}
          methods={mockContextValue.methods}
          isCurrentStepValid={true}
        />
      </FormProvider>
    );

    expect(screen.getByText('Test Field')).toBeInTheDocument();
  });
});
