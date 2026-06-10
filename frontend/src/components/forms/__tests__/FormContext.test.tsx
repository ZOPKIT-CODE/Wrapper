import { render, screen, fireEvent } from '@testing-library/react';
import { FormProvider, useFormContext } from '../contexts/FormContext';

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

// Test component that uses the context
const TestComponent = () => {
  const context = useFormContext();
  
  return (
    <div>
      <div data-testid="current-step">{context.currentStep}</div>
      <div data-testid="total-steps">{context.totalSteps}</div>
      <div data-testid="is-valid">{context.isCurrentStepValid ? 'valid' : 'invalid'}</div>
      <button 
        data-testid="next-button" 
        onClick={context.nextStep}
      >
        Next
      </button>
      <button 
        data-testid="prev-button" 
        onClick={context.prevStep}
      >
        Previous
      </button>
    </div>
  );
};

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
    },
    {
      id: 'step2',
      title: 'Step 2',
      description: 'Second step',
      showProgress: true,
      fields: []
    }
  ]
};

describe('FormContext', () => {
  const mockMethods = {
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
  };

  const mockContextValue = {
    config: mockConfig,
    currentStep: 0,
    totalSteps: 2,
    currentStepConfig: mockConfig.steps[0],
    isSubmitting: false,
    isCurrentStepValid: true,
    methods: mockMethods,
    nextStep: jest.fn(),
    prevStep: jest.fn(),
    goToStep: jest.fn(),
    handleFieldChange: jest.fn(),
    handleFieldBlur: jest.fn(),
    validateCurrentStep: jest.fn(),
    handleSubmit: jest.fn(),
    debug: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides context values correctly', () => {
    render(
      <FormProvider value={mockContextValue}>
        <TestComponent />
      </FormProvider>
    );

    expect(screen.getByTestId('current-step')).toHaveTextContent('0');
    expect(screen.getByTestId('total-steps')).toHaveTextContent('2');
    expect(screen.getByTestId('is-valid')).toHaveTextContent('valid');
  });

  it('calls nextStep when next button is clicked', () => {
    render(
      <FormProvider value={mockContextValue}>
        <TestComponent />
      </FormProvider>
    );

    fireEvent.click(screen.getByTestId('next-button'));
    expect(mockContextValue.nextStep).toHaveBeenCalledTimes(1);
  });

  it('calls prevStep when previous button is clicked', () => {
    render(
      <FormProvider value={mockContextValue}>
        <TestComponent />
      </FormProvider>
    );

    fireEvent.click(screen.getByTestId('prev-button'));
    expect(mockContextValue.prevStep).toHaveBeenCalledTimes(1);
  });

  it('throws error when used outside FormProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useFormContext must be used within a FormProvider');
    
    consoleSpy.mockRestore();
  });
});
