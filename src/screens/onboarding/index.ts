/**
 * Onboarding Screens
 *
 * Flow: Language → Welcome → DeviceChoice → Phone/LinkScan → Name → PIN → Demographics → NavigationTutorial → Completion
 *
 * DeviceChoice allows tablets to link to existing accounts via QR scan
 * instead of phone verification.
 *
 * Demographics is required for free users (country, region, age bracket).
 *
 * NavigationTutorial teaches the Hold-to-Navigate system before completing onboarding.
 */

export { LanguageSelectScreen } from './LanguageSelectScreen';
export { WelcomeScreen } from './WelcomeScreen';
export { DeviceChoiceScreen } from './DeviceChoiceScreen';
export { PhoneVerificationScreen } from './PhoneVerificationScreen';
export { DeviceLinkScanScreen } from './DeviceLinkScanScreen';
export { DeviceLinkShowQRScreen } from './DeviceLinkShowQRScreen';
export { NameInputScreen } from './NameInputScreen';
export { PinSetupScreen } from './PinSetupScreen';
export { DemographicsScreen } from './DemographicsScreen';
export { NavigationTutorialScreen } from './NavigationTutorialScreen';
export { CompletionScreen } from './CompletionScreen';
