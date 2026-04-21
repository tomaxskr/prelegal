import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NDAForm, { getEmptyFormData, type NDAFormData } from '@/components/NDAForm';

describe('NDAForm', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders all form sections', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    expect(screen.getByText('Purpose')).toBeInTheDocument();
    expect(screen.getByText('Term')).toBeInTheDocument();
    expect(screen.getByText('Governing Law & Jurisdiction')).toBeInTheDocument();
    expect(screen.getByText('MNDA Modifications')).toBeInTheDocument();
    expect(screen.getByText('Party 1')).toBeInTheDocument();
    expect(screen.getByText('Party 2')).toBeInTheDocument();
  });

  it('renders purpose textarea', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText('How Confidential Information may be used');
    expect(textarea).toBeInTheDocument();
  });

  it('renders purpose textarea with correct value', () => {
    const formData: NDAFormData = {
      ...getEmptyFormData(),
      purpose: 'Testing purposes',
    };
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText('How Confidential Information may be used');
    expect(textarea).toHaveValue('Testing purposes');
  });

  it('calls onChange when purpose is typed', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText('How Confidential Information may be used');
    fireEvent.change(textarea, { target: { value: 'New purpose' } });

    expect(mockOnChange).toHaveBeenCalled();
    const calledData = mockOnChange.mock.calls[0][0];
    expect(calledData.purpose).toBe('New purpose');
  });

  it('renders default effective date', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const dateInput = screen.getByDisplayValue(formData.effectiveDate);
    expect(dateInput).toBeInTheDocument();
  });

  it('calls onChange when effective date changes', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const dateInput = screen.getByDisplayValue(formData.effectiveDate);
    fireEvent.change(dateInput, { target: { value: '2025-01-15' } });

    expect(mockOnChange).toHaveBeenCalled();
    const calledData = mockOnChange.mock.calls[0][0];
    expect(calledData.effectiveDate).toBe('2025-01-15');
  });

  it('renders MNDA term radio buttons', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const radio1year = screen.getByLabelText('Expires 1 year(s) from Effective Date');
    const radioContinues = screen.getByLabelText('Continues until terminated');

    expect(radio1year).toBeChecked();
    expect(radioContinues).not.toBeChecked();
  });

  it('calls onChange when MNDA term changes', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const radioContinues = screen.getByLabelText('Continues until terminated');
    fireEvent.click(radioContinues);

    expect(mockOnChange).toHaveBeenCalled();
    const calledData = mockOnChange.mock.calls[0][0];
    expect(calledData.ndaTerm).toBe('continues');
  });

  it('renders governing law input', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g., Delaware');
    expect(input).toBeInTheDocument();
  });

  it('renders governing law input with correct value', () => {
    const formData: NDAFormData = {
      ...getEmptyFormData(),
      governingLaw: 'Delaware',
    };
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g., Delaware');
    expect(input).toHaveValue('Delaware');
  });

  it('calls onChange when governing law changes', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g., Delaware');
    fireEvent.change(input, { target: { value: 'California' } });

    expect(mockOnChange).toHaveBeenCalled();
    const calledData = mockOnChange.mock.calls[0][0];
    expect(calledData.governingLaw).toBe('California');
  });

  it('renders jurisdiction input', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g., courts located in Wilmington, DE');
    expect(input).toBeInTheDocument();
  });

  it('calls onChange when jurisdiction changes', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g., courts located in Wilmington, DE');
    fireEvent.change(input, { target: { value: 'San Francisco, CA' } });

    expect(mockOnChange).toHaveBeenCalled();
    const calledData = mockOnChange.mock.calls[0][0];
    expect(calledData.jurisdiction).toBe('San Francisco, CA');
  });

  it('renders modifications textarea', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText('List any modifications to the MNDA');
    expect(textarea).toBeInTheDocument();
  });

  it('renders modifications textarea with correct value', () => {
    const formData: NDAFormData = {
      ...getEmptyFormData(),
      modifications: 'Some modifications',
    };
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText('List any modifications to the MNDA');
    expect(textarea).toHaveValue('Some modifications');
  });

  it('calls onChange when modifications changes', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText('List any modifications to the MNDA');
    fireEvent.change(textarea, { target: { value: 'New modifications' } });

    expect(mockOnChange).toHaveBeenCalled();
    const calledData = mockOnChange.mock.calls[0][0];
    expect(calledData.modifications).toBe('New modifications');
  });

  it('renders party sections', () => {
    const formData = getEmptyFormData();
    render(<NDAForm formData={formData} onChange={mockOnChange} />);

    expect(screen.getByText('Party 1')).toBeInTheDocument();
    expect(screen.getByText('Party 2')).toBeInTheDocument();
  });
});

describe('getEmptyFormData', () => {
  it('returns correct default values', () => {
    const data = getEmptyFormData();

    expect(data.purpose).toBe('');
    expect(data.ndaTerm).toBe('1year');
    expect(data.termOfConfidentiality).toBe('1year');
    expect(data.governingLaw).toBe('');
    expect(data.jurisdiction).toBe('');
    expect(data.modifications).toBe('');
  });

  it('returns valid date for effectiveDate', () => {
    const data = getEmptyFormData();
    const today = new Date().toISOString().split('T')[0];
    expect(data.effectiveDate).toBe(today);
  });

  it('returns empty party objects', () => {
    const data = getEmptyFormData();

    expect(data.party1.signature).toBe('');
    expect(data.party1.printName).toBe('');
    expect(data.party1.title).toBe('');
    expect(data.party1.company).toBe('');
    expect(data.party1.noticeAddress).toBe('');
    expect(data.party1.date).toBe('');

    expect(data.party2.signature).toBe('');
    expect(data.party2.printName).toBe('');
    expect(data.party2.title).toBe('');
    expect(data.party2.company).toBe('');
    expect(data.party2.noticeAddress).toBe('');
    expect(data.party2.date).toBe('');
  });
});