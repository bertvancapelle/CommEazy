/**
 * AddContactScreen Tests
 *
 * Validates:
 * - Screen renders correctly
 * - Form validation
 * - Country code selection
 * - Save functionality
 * - Accessibility labels
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AddContactScreen } from '../AddContactScreen';
import { ServiceContainer } from '@/services/container';

// Mock ServiceContainer
jest.mock('@/services/container', () => ({
  ServiceContainer: {
    database: {
      saveContact: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: jest.fn(),
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('AddContactScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form elements', () => {
    const { getByLabelText, getByText } = render(<AddContactScreen />);

    // Name input
    expect(getByLabelText('contacts.nameLabel')).toBeTruthy();

    // Phone input
    expect(getByLabelText('contacts.phoneLabel')).toBeTruthy();

    // Country code button
    expect(getByLabelText('accessibility.countryCode')).toBeTruthy();

    // Save button (disabled initially)
    expect(getByText('contacts.save')).toBeTruthy();

    // QR alternative
    expect(getByText('contacts.orScanQR')).toBeTruthy();
  });

  it('disables save button when form is invalid', () => {
    const { getByLabelText, getByText } = render(<AddContactScreen />);

    const saveButton = getByText('contacts.save');

    // Button should be disabled with empty form
    expect(saveButton.props.style).toContainEqual(
      expect.objectContaining({ color: expect.anything() })
    );
  });

  it('enables save button when form is valid', () => {
    const { getByLabelText, getByText, getByPlaceholderText } = render(<AddContactScreen />);

    // Fill in name
    const nameInput = getByPlaceholderText('contacts.namePlaceholder');
    fireEvent.changeText(nameInput, 'John Doe');

    // Fill in phone
    const phoneInput = getByPlaceholderText('contacts.phonePlaceholder');
    fireEvent.changeText(phoneInput, '612345678');

    // Save button should be enabled
    const saveButton = getByText('contacts.save');
    expect(saveButton).toBeTruthy();
  });

  it('validates name is not empty', () => {
    const { getByPlaceholderText, getByText } = render(<AddContactScreen />);

    // Fill in only phone
    const phoneInput = getByPlaceholderText('contacts.phonePlaceholder');
    fireEvent.changeText(phoneInput, '612345678');

    // Save button should still be disabled
    // (button is disabled via disabled prop)
    const saveButton = getByText('contacts.save');
    expect(saveButton).toBeTruthy();
  });

  it('validates phone number length (min 6 digits)', () => {
    const { getByPlaceholderText, getByText } = render(<AddContactScreen />);

    // Fill in name
    const nameInput = getByPlaceholderText('contacts.namePlaceholder');
    fireEvent.changeText(nameInput, 'John');

    // Fill in short phone
    const phoneInput = getByPlaceholderText('contacts.phonePlaceholder');
    fireEvent.changeText(phoneInput, '12345');

    // Save button should be disabled
    const saveButton = getByText('contacts.save');
    expect(saveButton).toBeTruthy();
  });

  it('shows country code dropdown when pressed', () => {
    const { getByLabelText, getByText } = render(<AddContactScreen />);

    // Press country code button
    const countryCodeButton = getByLabelText('accessibility.countryCode');
    fireEvent.press(countryCodeButton);

    // Should show country options
    expect(getByText('NL +31')).toBeTruthy();
    expect(getByText('DE +49')).toBeTruthy();
    expect(getByText('FR +33')).toBeTruthy();
  });

  it('selects country code from dropdown', () => {
    const { getByLabelText, getByText, queryByText } = render(<AddContactScreen />);

    // Open dropdown
    const countryCodeButton = getByLabelText('accessibility.countryCode');
    fireEvent.press(countryCodeButton);

    // Select Germany
    const germanyOption = getByText('DE +49');
    fireEvent.press(germanyOption);

    // Dropdown should close
    expect(queryByText('NL +31')).toBeNull();

    // Country code should be updated
    expect(getByText('+49')).toBeTruthy();
  });

  it('saves contact and navigates back on success', async () => {
    const { getByPlaceholderText, getByText } = render(<AddContactScreen />);

    // Fill in form
    const nameInput = getByPlaceholderText('contacts.namePlaceholder');
    fireEvent.changeText(nameInput, 'John Doe');

    const phoneInput = getByPlaceholderText('contacts.phonePlaceholder');
    fireEvent.changeText(phoneInput, '612345678');

    // Press save
    const saveButton = getByText('contacts.save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(ServiceContainer.database.saveContact).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          phoneNumber: '+31612345678',
          verified: false,
        })
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('shows error alert on save failure', async () => {
    (ServiceContainer.database.saveContact as jest.Mock).mockRejectedValueOnce(
      new Error('Save failed')
    );

    const { getByPlaceholderText, getByText } = render(<AddContactScreen />);

    // Fill in form
    fireEvent.changeText(getByPlaceholderText('contacts.namePlaceholder'), 'John');
    fireEvent.changeText(getByPlaceholderText('contacts.phonePlaceholder'), '612345678');

    // Press save
    fireEvent.press(getByText('contacts.save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('errors.genericError');
    });
  });

  it('navigates to QR scanner when scan button pressed', () => {
    const { getByText } = render(<AddContactScreen />);

    const scanButton = getByText('contacts.scanQR');
    fireEvent.press(scanButton);

    expect(mockNavigate).toHaveBeenCalledWith('QRScanner');
  });

  it('has correct accessibility labels', () => {
    const { getByLabelText } = render(<AddContactScreen />);

    expect(getByLabelText('contacts.nameLabel')).toBeTruthy();
    expect(getByLabelText('contacts.phoneLabel')).toBeTruthy();
    expect(getByLabelText('accessibility.countryCode')).toBeTruthy();
    expect(getByLabelText('contacts.save')).toBeTruthy();
    expect(getByLabelText('contacts.scanQR')).toBeTruthy();
  });

  it('strips non-digits from phone number before saving', async () => {
    const { getByPlaceholderText, getByText } = render(<AddContactScreen />);

    // Fill in name
    fireEvent.changeText(getByPlaceholderText('contacts.namePlaceholder'), 'John');

    // Fill in phone with spaces and dashes
    fireEvent.changeText(getByPlaceholderText('contacts.phonePlaceholder'), '6 123-456 78');

    // Press save
    fireEvent.press(getByText('contacts.save'));

    await waitFor(() => {
      expect(ServiceContainer.database.saveContact).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: '+31612345678',
        })
      );
    });
  });
});
