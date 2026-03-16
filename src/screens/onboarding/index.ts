/**
 * Onboarding Screens
 *
 * Flow: Language → Welcome → DeviceChoice → Phone/LinkScan/InvitationCode → PIN → ProfileStep1 → ProfileStep2 → ProfileStep3 → NavigationTutorial → Completion
 *
 * DeviceChoice allows three paths:
 * 1. New Account → Phone verification (standard)
 * 2. Link Device → QR scan from existing device (tablets)
 * 3. Invitation Code → Enter code from family member (iPad standalone)
 *
 * Profile wizard (3 steps):
 *   Step 1 "Wie ben je?" — firstName*, lastName*, gender*, birthDate*, weddingDate
 *   Step 2 "Waar woon je?" — country*, street*, postalCode*, city*, province*
 *   Step 3 "Hoe bereiken we je?" — landline, mobile, email (all optional)
 *
 * NavigationTutorial teaches the Hold-to-Navigate system before completing onboarding.
 */

export { LanguageSelectScreen } from './LanguageSelectScreen';
export { WelcomeScreen } from './WelcomeScreen';
export { DeviceChoiceScreen } from './DeviceChoiceScreen';
export { PhoneVerificationScreen } from './PhoneVerificationScreen';
export { DeviceLinkScanScreen } from './DeviceLinkScanScreen';
export { DeviceLinkShowQRScreen } from './DeviceLinkShowQRScreen';
export { InvitationCodeScreen } from './InvitationCodeScreen';
export { PinSetupScreen } from './PinSetupScreen';
export { ProfileStep1Screen } from './ProfileStep1Screen';
export { ProfileStep2Screen } from './ProfileStep2Screen';
export { ProfileStep3Screen } from './ProfileStep3Screen';
export { NavigationTutorialScreen } from './NavigationTutorialScreen';
export { CompletionScreen } from './CompletionScreen';
