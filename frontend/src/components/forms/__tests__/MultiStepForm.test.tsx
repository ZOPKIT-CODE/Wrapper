import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiStepForm } from '../MultiStepForm';
import { onboardingFormConfig } from '../examples/onboardingConfig';

// Mock the toast function
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the form store
jest.mock('../stores/formStore', () => ({
  useFormState: () => ({
    currentStep: 0,
    values: {},
    errors: {},
    isSubmitting: false,
    setCurrentStep: jest.fn(),
    setValue: jest.fn(),
    setValues: jest.fn(),
    setError: jest.fn(),
    setErrors: jest.fn(),
    setIsSubmitting: jest.fn(),
    nextStep: jest.fn(),
    prevStep: jest.fn(),
  }),
}));

describe('MultiStepForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form with correct title and description', () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Welcome to Our Platform')).toBeInTheDocument();
    expect(screen.getByText("Let's get you set up with a few quick steps")).toBeInTheDocument();
  });

  it('renders the first step with correct title', () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Personal Information')).toBeInTheDocument();
    expect(screen.getByText('Tell us a bit about yourself')).toBeInTheDocument();
  });

  it('renders all fields from the first step', () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Date of Birth')).toBeInTheDocument();
    expect(screen.getByLabelText('Bio')).toBeInTheDocument();
  });

  it('shows required field indicators', () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
      />
    );

    const requiredFields = screen.getAllByText('*');
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it('renders progress indicator', () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('33% complete')).toBeInTheDocument();
  });

  it('renders step navigation buttons', () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeDisabled(); // Should be disabled until form is valid
  });

  it('handles form submission', async () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
      />
    );

    // Fill out the form
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '1234567890' } });
    fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } });

    // Wait for form validation
    await waitFor(() => {
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    // Click next to go to last step
    fireEvent.click(screen.getByText('Next'));

    // Should show submit button on last step
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });

  it('shows debug information when debug prop is true', () => {
    render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
        debug={true}
      />
    );

    expect(screen.getByText('Debug Information')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MultiStepForm
        config={onboardingFormConfig}
        onSubmit={mockOnSubmit}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
