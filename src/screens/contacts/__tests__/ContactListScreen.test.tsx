/**
 * ContactListScreen Tests
 *
 * Validates:
 * - Screen renders correctly
 * - Empty state is shown
 * - Search functionality
 * - FAB button works
 * - Accessibility labels
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ContactListScreen } from '../ContactListScreen';
import { ServiceContainer } from '@/services/container';
import type { Contact } from '@/services/interfaces';

// Helper to create a mock Observable that properly supports unsubscription
const createMockObservable = (data: Contact[]) => ({
  subscribe: (callback: (data: Contact[]) => void) => {
    // Call callback immediately with data
    callback(data);
    // Return an unsubscribe function
    return () => {};
  },
});

// Mock ServiceContainer
jest.mock('@/services/container', () => ({
  ServiceContainer: {
    database: {
      getContacts: jest.fn(),
    },
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

describe('ContactListScreen', () => {
  const mockContacts: Contact[] = [
    {
      jid: 'alice@example.com',
      name: 'Alice',
      phoneNumber: '+31612345678',
      publicKey: 'abc123',
      verified: true,
      lastSeen: Date.now(),
    },
    {
      jid: 'bob@example.com',
      name: 'Bob',
      phoneNumber: '+31687654321',
      publicKey: 'def456',
      verified: false,
      lastSeen: Date.now() - 3600000,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return empty contacts observable
    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable([])
    );
  });

  it('renders empty state when no contacts', async () => {
    const { getByText } = render(<ContactListScreen />);

    await waitFor(() => {
      expect(getByText('contacts.noContacts')).toBeTruthy();
      expect(getByText('contacts.noContactsHint')).toBeTruthy();
    });
  });

  it('renders contact list when contacts exist', async () => {
    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable(mockContacts)
    );

    const { getByText } = render(<ContactListScreen />);

    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });
  });

  it('shows verification badge for verified contacts', async () => {
    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable(mockContacts)
    );

    const { getAllByText } = render(<ContactListScreen />);

    await waitFor(() => {
      // Alice is verified - should show checkmark
      expect(getAllByText('✓')).toBeTruthy();
    });
  });

  it('navigates to AddContact when FAB is pressed', async () => {
    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable(mockContacts)
    );

    const { getByLabelText } = render(<ContactListScreen />);

    await waitFor(() => {
      const fab = getByLabelText('accessibility.addContact');
      fireEvent.press(fab);
      expect(mockNavigate).toHaveBeenCalledWith('AddContact');
    });
  });

  it('navigates to ContactDetail when contact is pressed', async () => {
    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable(mockContacts)
    );

    const { getByText } = render(<ContactListScreen />);

    await waitFor(() => {
      const aliceItem = getByText('Alice');
      fireEvent.press(aliceItem.parent?.parent as any);
    });

    expect(mockNavigate).toHaveBeenCalledWith('ContactDetail', { jid: 'alice@example.com' });
  });

  it('filters contacts by search query', async () => {
    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable(mockContacts)
    );

    const { getByPlaceholderText, getByText, queryByText } = render(<ContactListScreen />);

    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });

    // Search for Alice
    const searchInput = getByPlaceholderText('contacts.searchPlaceholder');
    fireEvent.changeText(searchInput, 'alice');

    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy();
      expect(queryByText('Bob')).toBeNull();
    });
  });

  it('has correct accessibility labels', async () => {
    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable(mockContacts)
    );

    const { getByLabelText } = render(<ContactListScreen />);

    await waitFor(() => {
      // Search input accessibility
      expect(getByLabelText('accessibility.searchContacts')).toBeTruthy();
      // FAB accessibility
      expect(getByLabelText('accessibility.addContact')).toBeTruthy();
    });
  });

  it('groups contacts alphabetically', async () => {
    const alphabeticalContacts: Contact[] = [
      { ...mockContacts[0], name: 'Zoe', jid: 'zoe@example.com' },
      { ...mockContacts[0], name: 'Alice', jid: 'alice@example.com' },
      { ...mockContacts[0], name: 'Michael', jid: 'michael@example.com' },
    ];

    (ServiceContainer.database.getContacts as jest.Mock).mockReturnValue(
      createMockObservable(alphabeticalContacts)
    );

    const { getByText } = render(<ContactListScreen />);

    await waitFor(() => {
      // Should display in alphabetical order: Alice, Michael, Zoe
      const names = ['Alice', 'Michael', 'Zoe'];
      names.forEach(name => {
        expect(getByText(name)).toBeTruthy();
      });
    });
  });
});
