import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TextField } from '../field-components/TextField';
import { SelectField } from '../field-components/SelectField';
import { SwitchField } from '../field-components/SwitchField';
import { FormProvider } from 'react-hook-form';
import { useForm } from 'react-hook-form';

// Mock react-hook-form
const mockUseForm = useForm as jest.MockedFunction<typeof useForm>;

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
  watch: jest.fn(() => ({})),
  reset: jest.fn(),
  control: {} as any,
  register: jest.fn(),
  unregister: jest.fn(),
  formState: {
    isValid: true,
    errors: {},
    isDirty: false,
    isSubmitting: false
  }
};

describe('Field Components', () => {
  beforeEach(() => {
    mockUseForm.mockReturnValue(mockMethods);
  });

  describe('TextField', () => {
    const textFieldProps = {
      field: {
        id: 'test-field',
        label: 'Test Field',
        type: 'text' as const,
        required: true,
        placeholder: 'Enter text'
      },
      value: '',
      onChange: jest.fn(),
      onBlur: jest.fn(),
      disabled: false
    };

    it('renders text field correctly', () => {
      render(
        <FormProvider {...mockMethods}>
          <TextField {...textFieldProps} />
        </FormProvider>
      );

      expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('shows required indicator', () => {
      render(
        <FormProvider {...mockMethods}>
          <TextField {...textFieldProps} />
        </FormProvider>
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('calls onChange when value changes', () => {
      render(
        <FormProvider {...mockMethods}>
          <TextField {...textFieldProps} />
        </FormProvider>
      );

      const input = screen.getByLabelText('Test Field');
      fireEvent.change(input, { target: { value: 'test value' } });

      expect(textFieldProps.onChange).toHaveBeenCalledWith('test value');
    });
  });

  describe('SelectField', () => {
    const selectFieldProps = {
      field: {
        id: 'test-select',
        label: 'Test Select',
        type: 'select' as const,
        required: true,
        placeholder: 'Select option',
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]
      },
      value: '',
      onChange: jest.fn(),
      onBlur: jest.fn(),
      disabled: false
    };

    it('renders select field correctly', () => {
      render(
        <FormProvider {...mockMethods}>
          <SelectField {...selectFieldProps} />
        </FormProvider>
      );

      expect(screen.getByLabelText('Test Select')).toBeInTheDocument();
      expect(screen.getByText('Select option')).toBeInTheDocument();
    });

    it('shows options when clicked', async () => {
      render(
        <FormProvider {...mockMethods}>
          <SelectField {...selectFieldProps} />
        </FormProvider>
      );

      const trigger = screen.getByRole('combobox');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
      });
    });
  });

  describe('SwitchField', () => {
    const switchFieldProps = {
      field: {
        id: 'test-switch',
        label: 'Test Switch',
        type: 'switch' as const,
        required: false,
        switchLabel: 'Toggle switch'
      },
      value: false,
      onChange: jest.fn(),
      disabled: false
    };

    it('renders switch field correctly', () => {
      render(
        <FormProvider {...mockMethods}>
          <SwitchField {...switchFieldProps} />
        </FormProvider>
      );

      expect(screen.getByText('Toggle switch')).toBeInTheDocument();
    });

    it('calls onChange when toggled', () => {
      render(
        <FormProvider {...mockMethods}>
          <SwitchField {...switchFieldProps} />
        </FormProvider>
      );

      const switchElement = screen.getByRole('switch');
      fireEvent.click(switchElement);

      expect(switchFieldProps.onChange).toHaveBeenCalledWith(true);
    });
  });
});
