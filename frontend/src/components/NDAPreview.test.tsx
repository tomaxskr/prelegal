import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NDAPreview from '@/components/NDAPreview';
import { getEmptyFormData, type NDAFormData } from '@/components/NDAForm';

describe('NDAPreview', () => {
  it('renders header', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText('Mutual Non-Disclosure Agreement')).toBeInTheDocument();
  });

  it('renders purpose with placeholder when empty', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText('[Purpose]')).toBeInTheDocument();
  });

  it('renders purpose value when provided', () => {
    const data: NDAFormData = { ...getEmptyFormData(), purpose: 'Testing business relationship' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText('Testing business relationship')).toBeInTheDocument();
  });

  it('renders effective date', () => {
    const data: NDAFormData = { ...getEmptyFormData(), effectiveDate: '2025-06-15' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText('June 15, 2025')).toBeInTheDocument();
  });

  it('renders placeholder for empty dates', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getAllByText('[Date]').length).toBeGreaterThan(0);
  });

  it('renders continues MNDA term', () => {
    const data: NDAFormData = { ...getEmptyFormData(), ndaTerm: 'continues' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText(/continues until terminated/)).toBeInTheDocument();
  });

  it('renders perpetuity term of confidentiality', () => {
    const data: NDAFormData = { ...getEmptyFormData(), termOfConfidentiality: 'perpetuity' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText(/in perpetuity/)).toBeInTheDocument();
  });

  it('renders governing law when provided', () => {
    const data: NDAFormData = { ...getEmptyFormData(), governingLaw: 'Delaware' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText(/Governing Law: Delaware/)).toBeInTheDocument();
  });

  it('renders placeholder for empty governing law', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText(/Governing Law: \[State\]/)).toBeInTheDocument();
  });

  it('renders jurisdiction when provided', () => {
    const data: NDAFormData = { ...getEmptyFormData(), jurisdiction: 'Wilmington, DE' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText(/Jurisdiction: Wilmington, DE/)).toBeInTheDocument();
  });

  it('renders placeholder for empty jurisdiction', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText(/Jurisdiction: \[Location\]/)).toBeInTheDocument();
  });

  it('renders modifications when provided', () => {
    const data: NDAFormData = { ...getEmptyFormData(), modifications: 'Custom clause' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText('Custom clause')).toBeInTheDocument();
  });

  it('does not render modifications section when empty', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    const modifications = screen.queryByText('MNDA Modifications');
    expect(modifications).not.toBeInTheDocument();
  });

  it('renders party 1 section', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText('PARTY 1')).toBeInTheDocument();
  });

  it('renders party 2 section', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText('PARTY 2')).toBeInTheDocument();
  });

  it('renders Standard Terms section', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText('Standard Terms')).toBeInTheDocument();
  });

  it('renders all 11 standard terms', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText('1. Introduction')).toBeInTheDocument();
    expect(screen.getByText('2. Use and Protection of Confidential Information')).toBeInTheDocument();
    expect(screen.getByText('3. Exceptions')).toBeInTheDocument();
    expect(screen.getByText('4. Disclosures Required by Law')).toBeInTheDocument();
    expect(screen.getByText('5. Term and Termination')).toBeInTheDocument();
    expect(screen.getByText('6. Return or Destruction of Confidential Information')).toBeInTheDocument();
    expect(screen.getByText('7. Proprietary Rights')).toBeInTheDocument();
    expect(screen.getByText('8. Disclaimer')).toBeInTheDocument();
    expect(screen.getByText('9. Governing Law and Jurisdiction')).toBeInTheDocument();
    expect(screen.getByText('10. Equitable Relief')).toBeInTheDocument();
    expect(screen.getByText('11. General')).toBeInTheDocument();
  });

  it('renders governing law in Standard Terms', () => {
    const data: NDAFormData = { ...getEmptyFormData(), governingLaw: 'California' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText(/governed by the laws of California/)).toBeInTheDocument();
  });

  it('renders jurisdiction in Standard Terms', () => {
    const data: NDAFormData = { ...getEmptyFormData(), jurisdiction: 'Los Angeles, CA' };
    render(<NDAPreview data={data} />);
    expect(screen.getByText(/Any suit must be in Los Angeles, CA/)).toBeInTheDocument();
  });

  it('renders placeholders when governing law and jurisdiction empty in Standard Terms', () => {
    render(<NDAPreview data={getEmptyFormData()} />);
    expect(screen.getByText(/laws of \[State\]/)).toBeInTheDocument();
    expect(screen.getByText(/must be in \[Location\]/)).toBeInTheDocument();
  });
});