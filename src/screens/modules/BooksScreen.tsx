/**
 * BooksScreen — E-books library and search module
 *
 * Senior-inclusive e-book reader with:
 * - Library of downloaded books (from Project Gutenberg)
 * - Book search by title/author
 * - Download progress tracking
 * - Clean-up/delete with storage info
 * - Large touch targets (60pt+)
 * - VoiceFocusable book list
 *
 * Voice commands supported:
 * - "speel" / "play" — Start TTS reading
 * - "pauze" / "pause" — Pause TTS
 * - "stop" — Stop TTS
 * - "volgende" / "next" — Next page
 * - "vorige" / "previous" — Previous page
 * - "[book title]" — Focus on book
 *
 * @see .claude/skills/ui-designer/SKILL.md
 * @see .claude/skills/accessibility-specialist/SKILL.md
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Image,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import { colors, typography, spacing, touchTargets, borderRadius } from '@/theme';
import { Icon, IconButton, VoiceFocusable, ModuleHeader } from '@/components';
import { useVoiceFocusList, useVoiceFocusContext } from '@/contexts/VoiceFocusContext';
import { useHoldGestureContextSafe } from '@/contexts/HoldGestureContext';
import { useBooksContext, useBooksAudioPlayer, type Book, type DownloadedBook } from '@/contexts/BooksContext';
import { searchBooks, getPopularBooks } from '@/services/gutenbergService';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/hooks/useFeedback';

// ============================================================
// Constants
// ============================================================

// Search input max length
const SEARCH_MAX_LENGTH = 100;

// Module color (consistent with WheelNavigationMenu) - Amber
const BOOKS_MODULE_COLOR = '#FF8F00';

// API timeout
const API_TIMEOUT_MS = 15000;

// Language mapping for Gutenberg (ISO 639-1 to Gutenberg language codes)
const LANGUAGE_MAP: Record<string, string> = {
  nl: 'nl',
  en: 'en',
  de: 'de',
  fr: 'fr',
  es: 'es',
};

// ============================================================
// Types
// ============================================================

type ApiError = 'network' | 'timeout' | 'server' | 'parse' | null;

// ============================================================
// Component
// ============================================================

export function BooksScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const { accentColor } = useAccentColor();
  const { isVoiceSessionActive } = useVoiceFocusContext();
  const holdGesture = useHoldGestureContextSafe();
  const isReducedMotion = useReducedMotion();
  const { triggerFeedback } = useFeedback();
  const searchInputRef = useRef<TextInput>(null);

  // Books Context
  const {
    library,
    isLibraryLoading,
    storageInfo,
    isDownloading,
    downloadProgress,
    currentDownload,
    downloadBook,
    deleteBook,
    deleteBooks,
    isBookDownloaded,
    openBook,
    refreshLibrary,
  } = useBooksContext();

  // Audio Player Context (for listen mode)
  const { openBookForListening } = useBooksAudioPlayer();

  // State
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState<ApiError>(null);
  // Default to Library tab — seniors want quick access to their downloaded books
  const [showLibrary, setShowLibrary] = useState(true);
  // Welcome modal for first-time users
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  // Cleanup modal for deleting books
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  // Selected books for batch delete
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  // Track if we've shown the welcome modal this session
  const hasShownWelcomeRef = useRef(false);
  // Mode selection modal (Read vs Listen)
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedBookForMode, setSelectedBookForMode] = useState<DownloadedBook | null>(null);

  // Load popular books callback - defined before useEffects that use it
  const loadPopularBooks = useCallback(async () => {
    setIsSearching(true);
    setApiError(null);

    try {
      const language = LANGUAGE_MAP[i18n.language] || 'en';
      const result = await getPopularBooks(language);

      if (result.error) {
        setApiError(result.error);
      } else if (result.data) {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error('[BooksScreen] Failed to load popular books:', error);
      setApiError('network');
    }

    setIsSearching(false);
  }, [i18n.language]);

  // Show welcome modal if library is empty on first load
  useEffect(() => {
    if (!isLibraryLoading && library.length === 0 && !hasShownWelcomeRef.current) {
      hasShownWelcomeRef.current = true;
      setShowWelcomeModal(true);
    }
  }, [isLibraryLoading, library.length]);

  // Load popular books when switching to search tab with empty results
  useEffect(() => {
    if (!showLibrary && searchResults.length === 0 && !searchQuery.trim()) {
      loadPopularBooks();
    }
  }, [showLibrary, searchResults.length, searchQuery, loadPopularBooks]);

  // Listen for format error events (e.g., EPUB files that need re-download)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'booksFormatError',
      ({ book, message }) => {
        Alert.alert(
          t('modules.books.errors.formatNotSupportedTitle'),
          t('modules.books.errors.formatNotSupported'),
          [
            {
              text: t('common.ok'),
              style: 'default',
            },
          ]
        );
        // Refresh library to reflect the deleted book
        refreshLibrary();
      }
    );

    return () => subscription.remove();
  }, [t, refreshLibrary]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadPopularBooks();
      return;
    }

    setIsSearching(true);
    setApiError(null);

    try {
      const language = LANGUAGE_MAP[i18n.language] || 'en';
      const result = await searchBooks(searchQuery, language);

      if (result.error) {
        setApiError(result.error);
        await triggerFeedback('error');
      } else if (result.data) {
        setSearchResults(result.data);

        if (result.data.length === 0) {
          AccessibilityInfo.announceForAccessibility(
            t('modules.books.noResults')
          );
        } else {
          AccessibilityInfo.announceForAccessibility(
            t('modules.books.resultsFound', { count: result.data.length })
          );
        }
      }
    } catch (error) {
      console.error('[BooksScreen] Search failed:', error);
      setApiError('network');
      await triggerFeedback('error');
    }

    setIsSearching(false);
  }, [searchQuery, i18n.language, t, triggerFeedback, loadPopularBooks]);

  // Handle book selection
  const handleBookPress = useCallback(async (book: Book | DownloadedBook) => {
    // Block if hold gesture was consumed
    if (holdGesture?.isGestureConsumed()) {
      return;
    }

    triggerFeedback('tap');

    // If downloaded, show mode selection modal (Read vs Listen)
    if ('localPath' in book) {
      setSelectedBookForMode(book as DownloadedBook);
      setShowModeModal(true);
    } else if (isBookDownloaded(book.id)) {
      // Find in library and show mode modal
      const downloadedBook = library.find(b => b.id === book.id);
      if (downloadedBook) {
        setSelectedBookForMode(downloadedBook);
        setShowModeModal(true);
      }
    } else {
      // Show download confirmation
      Alert.alert(
        t('modules.books.downloadTitle'),
        t('modules.books.downloadMessage', { title: book.title }),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('modules.books.download'),
            onPress: async () => {
              triggerFeedback('success');
              await downloadBook(book);
            },
          },
        ]
      );
    }
  }, [holdGesture, triggerFeedback, isBookDownloaded, library, downloadBook, t]);

  // Handle mode selection (Read vs Listen)
  const handleModeSelect = useCallback(async (mode: 'read' | 'listen') => {
    if (!selectedBookForMode) return;

    setShowModeModal(false);
    triggerFeedback('tap');

    if (mode === 'read') {
      await openBook(selectedBookForMode);
      navigation.navigate('BookReader' as never);
    } else {
      await openBookForListening(selectedBookForMode);
      navigation.navigate('BookPlayer' as never);
    }

    setSelectedBookForMode(null);
  }, [selectedBookForMode, openBook, openBookForListening, navigation, triggerFeedback]);

  // Handle delete confirmation
  const handleDeleteBook = useCallback((book: DownloadedBook) => {
    Alert.alert(
      t('modules.books.deleteTitle'),
      t('modules.books.deleteMessage', { title: book.title }),
      [
        {
          text: t('common.no'),
          style: 'cancel',
        },
        {
          text: t('common.yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBook(book.id);
              triggerFeedback('success');
            } catch (error) {
              console.error('[BooksScreen] Delete failed:', error);
              triggerFeedback('error');
            }
          },
        },
      ]
    );
  }, [deleteBook, triggerFeedback, t]);

  // Cleanup modal - batch delete
  const handleBatchDelete = useCallback(async () => {
    if (selectedForDelete.size === 0) return;

    try {
      await deleteBooks(Array.from(selectedForDelete));
      setSelectedForDelete(new Set());
      setShowCleanupModal(false);
      triggerFeedback('success');

      AccessibilityInfo.announceForAccessibility(
        t('modules.books.booksDeleted', { count: selectedForDelete.size })
      );
    } catch (error) {
      console.error('[BooksScreen] Batch delete failed:', error);
      triggerFeedback('error');
    }
  }, [selectedForDelete, deleteBooks, triggerFeedback, t]);

  const toggleSelectForDelete = useCallback((bookId: string) => {
    setSelectedForDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) {
        newSet.delete(bookId);
      } else {
        newSet.add(bookId);
      }
      return newSet;
    });
  }, []);

  // Voice focus for book list
  const displayedBooks = useMemo(() => {
    if (showLibrary) {
      return library ?? [];
    }
    return searchResults ?? [];
  }, [showLibrary, library, searchResults]);

  const voiceFocusItems = useMemo(() => {
    if (!isFocused || !displayedBooks || displayedBooks.length === 0) return [];
    return displayedBooks.map((book, index) => ({
      id: book.id,
      label: book.title,
      index,
      onSelect: () => handleBookPress(book),
    }));
  }, [displayedBooks, isFocused, handleBookPress]);

  const { scrollRef, isFocused: isItemFocused, getFocusStyle } = useVoiceFocusList(
    'books-list',
    voiceFocusItems
  );

  // Format file size
  const formatSize = useCallback((bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.innerContainer}>
        {/* Module Header — standardized component with AdMob placeholder */}
        <ModuleHeader
          moduleId="books"
          icon="book"
          title={t('modules.books.title')}
          currentSource="books"
          showAdMob={true}
        />

        {/* Tab selector: Library / Search */}
        <View style={styles.tabBar}>
          {/* Library tab */}
          <TouchableOpacity
            style={[
              styles.tab,
              showLibrary
                ? { backgroundColor: accentColor.primary }
                : styles.tabInactive,
            ]}
            onPress={() => setShowLibrary(true)}
            accessibilityRole="tab"
            accessibilityState={{ selected: showLibrary }}
            accessibilityLabel={t('modules.books.libraryTab', { count: library.length })}
          >
            <View style={styles.tabIconRow}>
              <Icon
                name="book"
                size={28}
                color={showLibrary ? colors.textOnPrimary : colors.textSecondary}
              />
              {library.length > 0 && (
                <View style={[
                  styles.tabCountBadge,
                  showLibrary && styles.tabCountBadgeActive,
                ]}>
                  <Text style={[
                    styles.tabCountText,
                    showLibrary && styles.tabCountTextActive,
                  ]}>
                    {library.length}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.tabText,
              showLibrary && styles.tabTextActive,
            ]}>
              {t('modules.books.library')}
            </Text>
          </TouchableOpacity>

          {/* Search tab */}
          <TouchableOpacity
            style={[
              styles.tab,
              !showLibrary
                ? { backgroundColor: accentColor.primary }
                : styles.tabInactive,
            ]}
            onPress={() => setShowLibrary(false)}
            accessibilityRole="tab"
            accessibilityState={{ selected: !showLibrary }}
            accessibilityLabel={t('modules.books.searchTab')}
          >
            <View style={styles.tabIconRow}>
              <Icon
                name="search"
                size={28}
                color={!showLibrary ? colors.textOnPrimary : colors.textSecondary}
              />
            </View>
            <Text style={[
              styles.tabText,
              !showLibrary && styles.tabTextActive,
            ]}>
              {t('modules.books.search')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search section */}
        {!showLibrary && (
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder={t('modules.books.searchPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                  handleSearch();
                }}
                returnKeyType="search"
                maxLength={SEARCH_MAX_LENGTH}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel={t('modules.books.searchPlaceholder')}
              />
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: accentColor.primary }]}
                onPress={() => {
                  Keyboard.dismiss();
                  handleSearch();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.books.searchButton')}
              >
                <Icon name="search" size={24} color={colors.textOnPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Library header with cleanup button */}
        {showLibrary && library.length > 0 && (
          <View style={styles.libraryHeader}>
            <View style={styles.storageInfo}>
              <Text style={styles.storageInfoText}>
                {t('modules.books.storageUsed', {
                  size: storageInfo?.formattedUsed || '0 B',
                  count: library.length,
                })}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.cleanupButton, { borderColor: accentColor.primary }]}
              onPress={() => {
                triggerFeedback('tap');
                setShowCleanupModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('modules.books.cleanup')}
            >
              <Icon name="trash" size={20} color={accentColor.primary} />
              <Text style={[styles.cleanupButtonText, { color: accentColor.primary }]}>
                {t('modules.books.cleanup')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Download progress banner */}
        {isDownloading && currentDownload && (
          <View style={styles.downloadBanner}>
            <ActivityIndicator size="small" color={accentColor.primary} />
            <View style={styles.downloadInfo}>
              <Text style={styles.downloadTitle} numberOfLines={1}>
                {t('modules.books.downloading')}
              </Text>
              <Text style={styles.downloadBookTitle} numberOfLines={1}>
                {currentDownload.title}
              </Text>
            </View>
            <View style={styles.downloadProgressContainer}>
              <View
                style={[
                  styles.downloadProgressBar,
                  {
                    width: `${Math.round(downloadProgress * 100)}%`,
                    backgroundColor: accentColor.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.downloadProgressText}>
              {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        )}

        {/* Book list */}
        {(showLibrary ? isLibraryLoading : isSearching) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accentColor.primary} />
            <Text style={styles.loadingText}>{t('modules.books.loading')}</Text>
          </View>
        ) : apiError ? (
          <View style={styles.errorContainer}>
            <Icon name="warning" size={64} color={colors.error} />
            <Text style={styles.errorTitle}>{t(`modules.books.errors.${apiError}Title`)}</Text>
            <Text style={styles.errorMessage}>{t(`modules.books.errors.${apiError}`)}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: accentColor.primary }]}
              onPress={() => {
                triggerFeedback('tap');
                if (showLibrary) {
                  refreshLibrary();
                } else {
                  handleSearch();
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.tryAgain')}
            >
              <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        ) : displayedBooks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon
              name={showLibrary ? 'book' : 'search'}
              size={64}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>
              {showLibrary
                ? t('modules.books.emptyLibrary')
                : t('modules.books.noResults')}
            </Text>
            {showLibrary && (
              <>
                <Text style={styles.emptyHint}>
                  {t('modules.books.emptyLibraryHint')}
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionButton, { backgroundColor: accentColor.primary }]}
                  onPress={() => {
                    triggerFeedback('tap');
                    setShowLibrary(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('modules.books.goToSearch')}
                >
                  <Icon name="search" size={24} color={colors.textOnPrimary} />
                  <Text style={styles.emptyActionButtonText}>
                    {t('modules.books.goToSearch')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.bookList}
            contentContainerStyle={styles.bookListContent}
          >
            {/* Search results header */}
            {!showLibrary && !searchQuery.trim() && (
              <Text style={styles.sectionHeader}>
                {t('modules.books.popularBooks')}
              </Text>
            )}

            {displayedBooks.map((book, index) => {
              const isDownloaded = 'localPath' in book || isBookDownloaded(book.id);
              const isCurrentlyDownloading = currentDownload?.id === book.id;

              return (
                <VoiceFocusable
                  key={book.id}
                  id={book.id}
                  label={book.title}
                  index={index}
                  onSelect={() => handleBookPress(book)}
                >
                  <View
                    style={[
                      styles.bookItem,
                      isItemFocused(book.id) && getFocusStyle(),
                    ]}
                  >
                    {/* Book cover */}
                    <View style={styles.bookCover}>
                      {book.coverUrl ? (
                        <Image
                          source={{ uri: book.coverUrl }}
                          style={styles.bookCoverImage}
                          resizeMode="cover"
                          accessibilityLabel={t('modules.books.coverAlt', { title: book.title })}
                        />
                      ) : (
                        <View style={[styles.bookCoverImage, styles.bookCoverPlaceholder]}>
                          <Icon name="book" size={32} color={colors.textOnPrimary} />
                        </View>
                      )}
                    </View>

                    {/* Book info - tappable */}
                    <TouchableOpacity
                      style={styles.bookInfoTouchable}
                      onPress={() => handleBookPress(book)}
                      onLongPress={() => {}}
                      delayLongPress={300}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${book.title} ${t('common.by')} ${book.author}`}
                      accessibilityHint={
                        isDownloaded
                          ? t('modules.books.tapToRead')
                          : t('modules.books.tapToDownload')
                      }
                    >
                      <View style={styles.bookInfo}>
                        <Text style={styles.bookTitle} numberOfLines={2}>
                          {book.title}
                        </Text>
                        <Text style={styles.bookAuthor} numberOfLines={1}>
                          {book.author}
                        </Text>
                        {/* Status indicators */}
                        <View style={styles.bookStatus}>
                          {isDownloaded && (
                            <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                              <Icon name="check" size={14} color={colors.textOnPrimary} />
                              <Text style={styles.statusBadgeText}>
                                {t('modules.books.downloaded')}
                              </Text>
                            </View>
                          )}
                          {isCurrentlyDownloading && (
                            <View style={[styles.statusBadge, { backgroundColor: accentColor.primary }]}>
                              <ActivityIndicator size="small" color={colors.textOnPrimary} />
                              <Text style={styles.statusBadgeText}>
                                {Math.round(downloadProgress * 100)}%
                              </Text>
                            </View>
                          )}
                          {!isDownloaded && !isCurrentlyDownloading && book.fileSize && (
                            <Text style={styles.bookSize}>
                              {formatSize(book.fileSize)}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Action buttons */}
                    {showLibrary && isDownloaded && (
                      <IconButton
                        icon="trash"
                        onPress={() => handleDeleteBook(book as DownloadedBook)}
                        accessibilityLabel={t('modules.books.deleteBook', { title: book.title })}
                        size={24}
                      />
                    )}
                    {!showLibrary && !isDownloaded && !isCurrentlyDownloading && (
                      <IconButton
                        icon="download"
                        onPress={() => {
                          triggerFeedback('tap');
                          downloadBook(book);
                        }}
                        accessibilityLabel={t('modules.books.downloadBook', { title: book.title })}
                        size={24}
                      />
                    )}
                  </View>
                </VoiceFocusable>
              );
            })}
          </ScrollView>
        )}

        {/* Voice hint */}
        {isVoiceSessionActive && (
          <View style={styles.voiceHint}>
            <Text style={styles.voiceHintText}>
              {t('modules.books.voiceHint')}
            </Text>
          </View>
        )}

        {/* Welcome Modal */}
        <Modal
          visible={showWelcomeModal}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            setShowWelcomeModal(false);
            setShowLibrary(false);
          }}
          accessibilityViewIsModal={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Icon name="book" size={48} color={BOOKS_MODULE_COLOR} />
                <Text style={styles.modalTitle}>{t('modules.books.welcomeTitle')}</Text>
              </View>

              <Text style={styles.modalText}>
                {t('modules.books.welcomeText')}
              </Text>

              <View style={styles.modalStep}>
                <View style={styles.modalStepNumber}>
                  <Text style={styles.modalStepNumberText}>1</Text>
                </View>
                <Text style={styles.modalStepText}>
                  {t('modules.books.welcomeStep1')}
                </Text>
              </View>

              <View style={styles.modalStep}>
                <View style={styles.modalStepNumber}>
                  <Text style={styles.modalStepNumberText}>2</Text>
                </View>
                <Text style={styles.modalStepText}>
                  {t('modules.books.welcomeStep2')}
                </Text>
              </View>

              <View style={styles.modalStep}>
                <View style={styles.modalStepNumber}>
                  <Text style={styles.modalStepNumberText}>3</Text>
                </View>
                <Text style={styles.modalStepText}>
                  {t('modules.books.welcomeStep3')}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: accentColor.primary }]}
                onPress={() => {
                  triggerFeedback('tap');
                  setShowWelcomeModal(false);
                  setShowLibrary(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('modules.books.welcomeButton')}
              >
                <Icon name="search" size={24} color={colors.textOnPrimary} />
                <Text style={styles.modalButtonText}>
                  {t('modules.books.welcomeButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Cleanup Modal */}
        <Modal
          visible={showCleanupModal}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'slide'}
          onRequestClose={() => {
            setShowCleanupModal(false);
            setSelectedForDelete(new Set());
          }}
          accessibilityViewIsModal={true}
        >
          <View style={styles.cleanupModalOverlay}>
            <View style={[styles.cleanupModalContent, { paddingTop: insets.top + spacing.md }]}>
              {/* Header */}
              <View style={styles.cleanupModalHeader}>
                <Text style={styles.cleanupModalTitle}>
                  {t('modules.books.cleanupTitle')}
                </Text>
                <IconButton
                  icon="close"
                  onPress={() => {
                    setShowCleanupModal(false);
                    setSelectedForDelete(new Set());
                  }}
                  accessibilityLabel={t('common.close')}
                  size={24}
                />
              </View>

              <Text style={styles.cleanupModalSubtitle}>
                {t('modules.books.cleanupSubtitle')}
              </Text>

              {/* Storage info */}
              <View style={styles.cleanupStorageInfo}>
                <Icon name="folder" size={24} color={colors.textSecondary} />
                <Text style={styles.cleanupStorageText}>
                  {t('modules.books.storageUsed', {
                    size: storageInfo?.formattedUsed || '0 B',
                    count: library.length,
                  })}
                </Text>
              </View>

              {/* Select all / deselect all */}
              <View style={styles.cleanupSelectAll}>
                <TouchableOpacity
                  style={styles.cleanupSelectButton}
                  onPress={() => {
                    if (selectedForDelete.size === library.length) {
                      setSelectedForDelete(new Set());
                    } else {
                      setSelectedForDelete(new Set(library.map(b => b.id)));
                    }
                  }}
                  accessibilityRole="button"
                >
                  <Icon
                    name={selectedForDelete.size === library.length ? 'check-square' : 'square'}
                    size={24}
                    color={accentColor.primary}
                  />
                  <Text style={[styles.cleanupSelectText, { color: accentColor.primary }]}>
                    {selectedForDelete.size === library.length
                      ? t('modules.books.deselectAll')
                      : t('modules.books.selectAll')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Book list for selection */}
              <ScrollView style={styles.cleanupBookList}>
                {library.map(book => (
                  <TouchableOpacity
                    key={book.id}
                    style={[
                      styles.cleanupBookItem,
                      selectedForDelete.has(book.id) && {
                        backgroundColor: colors.errorBackground,
                        borderColor: colors.error,
                      },
                    ]}
                    onPress={() => toggleSelectForDelete(book.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selectedForDelete.has(book.id) }}
                    accessibilityLabel={book.title}
                  >
                    <Icon
                      name={selectedForDelete.has(book.id) ? 'check-square' : 'square'}
                      size={24}
                      color={selectedForDelete.has(book.id) ? colors.error : colors.textSecondary}
                    />
                    <View style={styles.cleanupBookInfo}>
                      <Text style={styles.cleanupBookTitle} numberOfLines={1}>
                        {book.title}
                      </Text>
                      <Text style={styles.cleanupBookSize}>
                        {formatSize(book.fileSize)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Delete button */}
              <TouchableOpacity
                style={[
                  styles.cleanupDeleteButton,
                  selectedForDelete.size === 0
                    ? { backgroundColor: colors.border }
                    : { backgroundColor: colors.error },
                ]}
                onPress={handleBatchDelete}
                disabled={selectedForDelete.size === 0}
                accessibilityRole="button"
                accessibilityLabel={t('modules.books.deleteSelected', { count: selectedForDelete.size })}
                accessibilityState={{ disabled: selectedForDelete.size === 0 }}
              >
                <Icon name="trash" size={24} color={colors.textOnPrimary} />
                <Text style={styles.cleanupDeleteButtonText}>
                  {t('modules.books.deleteSelected', { count: selectedForDelete.size })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Mode Selection Modal (Read vs Listen) */}
        <Modal
          visible={showModeModal}
          transparent={true}
          animationType={isReducedMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            setShowModeModal(false);
            setSelectedBookForMode(null);
          }}
          accessibilityViewIsModal={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modeModalContent}>
              {/* Book title */}
              {selectedBookForMode && (
                <View style={styles.modeModalHeader}>
                  <Text style={styles.modeModalTitle} numberOfLines={2}>
                    {selectedBookForMode.title}
                  </Text>
                  <Text style={styles.modeModalAuthor} numberOfLines={1}>
                    {selectedBookForMode.author}
                  </Text>
                </View>
              )}

              {/* Mode options */}
              <Text style={styles.modeModalQuestion}>
                {t('modules.books.modeQuestion')}
              </Text>

              {/* Read option */}
              <TouchableOpacity
                style={styles.modeOption}
                onPress={() => handleModeSelect('read')}
                accessibilityRole="button"
                accessibilityLabel={t('modules.books.read')}
                accessibilityHint={t('modules.books.readHint')}
              >
                <View style={[styles.modeOptionIcon, { backgroundColor: BOOKS_MODULE_COLOR }]}>
                  <Icon name="document-text" size={32} color={colors.textOnPrimary} />
                </View>
                <View style={styles.modeOptionText}>
                  <Text style={styles.modeOptionTitle}>{t('modules.books.read')}</Text>
                  <Text style={styles.modeOptionDescription}>{t('modules.books.readDescription')}</Text>
                </View>
              </TouchableOpacity>

              {/* Listen option */}
              <TouchableOpacity
                style={styles.modeOption}
                onPress={() => handleModeSelect('listen')}
                accessibilityRole="button"
                accessibilityLabel={t('modules.books.listen')}
                accessibilityHint={t('modules.books.listenHint')}
              >
                <View style={[styles.modeOptionIcon, { backgroundColor: BOOKS_MODULE_COLOR }]}>
                  <Icon name="headset" size={32} color={colors.textOnPrimary} />
                </View>
                <View style={styles.modeOptionText}>
                  <Text style={styles.modeOptionTitle}>{t('modules.books.listen')}</Text>
                  <Text style={styles.modeOptionDescription}>{t('modules.books.listenDescription')}</Text>
                </View>
              </TouchableOpacity>

              {/* Cancel button */}
              <TouchableOpacity
                style={styles.modeModalCancel}
                onPress={() => {
                  setShowModeModal(false);
                  setSelectedBookForMode(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={styles.modeModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
  },
  // moduleHeader styles removed — using standardized ModuleHeader component
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: touchTargets.comfortable,
  },
  tabInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tabCountBadge: {
    backgroundColor: colors.border,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabCountText: {
    ...typography.small,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  tabCountTextActive: {
    color: colors.textOnPrimary,
  },
  tabText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.textOnPrimary,
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    minHeight: touchTargets.minimum,
  },
  searchButton: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  storageInfo: {
    flex: 1,
  },
  storageInfoText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  cleanupButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  downloadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  downloadInfo: {
    flex: 1,
  },
  downloadTitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  downloadBookTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  downloadProgressContainer: {
    width: 60,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  downloadProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  downloadProgressText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
  errorMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  retryButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    marginTop: spacing.md,
  },
  emptyActionButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  bookList: {
    flex: 1,
  },
  bookListContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    ...typography.label,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    minHeight: touchTargets.comfortable + spacing.sm * 2,
  },
  bookCover: {
    width: 56,
    height: 80,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  bookCoverImage: {
    width: '100%',
    height: '100%',
  },
  bookCoverPlaceholder: {
    backgroundColor: BOOKS_MODULE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfoTouchable: {
    flex: 1,
    minHeight: touchTargets.minimum,
    justifyContent: 'center',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bookAuthor: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    ...typography.small,
    fontSize: 11,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  bookSize: {
    ...typography.small,
    color: colors.textTertiary,
  },
  voiceHint: {
    position: 'absolute',
    bottom: 120,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  voiceHintText: {
    ...typography.body,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 400,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
  modalText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 26,
  },
  modalStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  modalStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalStepNumberText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalStepText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    marginTop: spacing.lg,
  },
  modalButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  // Cleanup modal styles
  cleanupModalOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cleanupModalContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  cleanupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cleanupModalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cleanupModalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  cleanupStorageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  cleanupStorageText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  cleanupSelectAll: {
    marginBottom: spacing.md,
  },
  cleanupSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  cleanupSelectText: {
    ...typography.body,
    fontWeight: '600',
  },
  cleanupBookList: {
    flex: 1,
  },
  cleanupBookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    minHeight: touchTargets.minimum,
  },
  cleanupBookInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  cleanupBookTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  cleanupBookSize: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cleanupDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: touchTargets.comfortable,
    marginTop: spacing.md,
  },
  cleanupDeleteButtonText: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  // Mode selection modal styles
  modeModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: 400,
    width: '100%',
  },
  modeModalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  modeModalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
  modeModalAuthor: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modeModalQuestion: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: touchTargets.comfortable,
    gap: spacing.md,
  },
  modeOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionText: {
    flex: 1,
  },
  modeOptionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modeOptionDescription: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  modeModalCancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  modeModalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
