import type { SettingsHost } from "./settingsIntegration";
import type { LearningHost } from "./learning";
import type { NotificationHost } from "./notifications";
import type { ReactNode } from "react";
import type { LocalePreference } from "./i18n";
import type { BrowserDirectoryHandle } from "./utils/browserUniverse";

export type SuiteLicenseStatus = "idle" | "activating" | "active" | "inactive" | "error";

export type SuiteLicenseInstance = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SuiteLicenseControls = {
  status: SuiteLicenseStatus;
  licenseKey?: string;
  instanceName?: string;
  currentInstanceId?: string;
  activationUsage?: number;
  activationLimit?: number;
  error?: string;
  instances?: SuiteLicenseInstance[];
  devicesStatus?: "idle" | "loading" | "error";
  devicesError?: string;
  onActivate: (licenseKey: string) => void;
  onValidate: () => void;
  onDeactivate: () => void;
  onLoadDevices: () => void;
  onDeactivateDevice: (instanceId: string) => void;
};

export type SuiteSettings = {
  /** Optional visual preference; older hosts retain the default atmosphere. */
  ambientBackground?: boolean;
  backgroundScene?: string;
  onBackgroundSceneChange?: (scene: string) => void;
  onAmbientBackgroundChange?: (enabled: boolean) => void;
  localePreference: LocalePreference;
  locale: "en" | "es";
  onLocalePreferenceChange: (preference: LocalePreference) => void;
  primaryFont: string;
  onPrimaryFontChange: (font: string) => void;
  style: string;
  onStyleChange: (style: string) => void;
  onToggleStyleMode: () => void;
  update: SuiteUpdateControls;
  license: SuiteLicenseControls;
};

export type SuiteUpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "error";

export type SuiteUpdateControls = {
  appName: string;
  currentVersion: string;
  identifier: string;
  platform: string;
  status: SuiteUpdateStatus;
  availableVersion?: string;
  releaseNotes?: string;
  progress?: number;
  downloadedBytes?: number;
  contentLength?: number;
  lastCheckedAt?: string;
  error?: string;
  onCheck: () => void;
  onInstall: () => void;
};

export type SuiteChrome = {
  onOpenCanonEntity?: (target: { entityId: string; variantId?: string; propertyId?: string }) => void | Promise<void>;
  onOpenCanonProperties?: () => void | Promise<void>;
  /** Changes only after a successful WorldNotion note/schema write. */
  canonRevision?: number;
  /** Optional embedded settings center. Older hosts keep the local dialog. */
  settingsHost?: SettingsHost;
  /** Optional onboarding host; absent in standalone and older Suite builds. */
  learning?: LearningHost;
  /** Optional host for one notification history across the Suite. */
  notifications?: NotificationHost;
  /** Opens the app's existing settings, including the host's Suite sections. */
  registerSettingsOpener?: (open: (section?: "suite") => void) => () => void;
  active: boolean;
  sharedUniversePath?: string;
  /** Browser folder handle supplied by the integrated Suite web shell. */
  sharedUniverseDirectory?: BrowserDirectoryHandle;
  onReady?: () => void;
  onHome?: () => void;
  onReload?: () => void;
  /** Suite must await all mounted tools before publishing a different universe. */
  registerUniverseSwitchGuard?: (guard: () => Promise<boolean>) => () => void;
  /** Integrated shells own the one native window-control group. */
  windowControlsManaged?: boolean;
  renderAppSwitcher: () => ReactNode;
  suiteSettings?: SuiteSettings;
};
