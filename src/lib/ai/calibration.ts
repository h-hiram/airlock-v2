export interface DeviceCalibrationResult {
  isNanoAvailable: boolean;
  availabilityStatus: 'available' | 'after-download' | 'no' | 'unsupported_browser';
  benchmarkLatencyMs?: number;
  recommendedRoute: 'on_device' | 'local_deterministic' | 'consented_cloud';
  diagnosticMessage: string;
}

export async function runDeviceCalibration(): Promise<DeviceCalibrationResult> {
  if (typeof window === 'undefined') {
    return {
      isNanoAvailable: false,
      availabilityStatus: 'unsupported_browser',
      recommendedRoute: 'local_deterministic',
      diagnosticMessage: 'Non-browser execution environment.',
    };
  }

  try {
    const win = window as unknown as {
      LanguageModel?: { availability?: () => Promise<string>; create?: (opts?: unknown) => Promise<unknown> };
      ai?: {
        languageModel?: {
          availability?: () => Promise<string>;
          capabilities?: () => Promise<{ available: string }>;
          create?: (opts?: unknown) => Promise<unknown>;
        };
      };
    };

    let status: string | undefined;

    if (typeof win.LanguageModel?.availability === 'function') {
      status = await win.LanguageModel.availability();
    } else if (typeof win.ai?.languageModel?.availability === 'function') {
      status = await win.ai.languageModel.availability();
    } else if (typeof win.ai?.languageModel?.capabilities === 'function') {
      const caps = await win.ai.languageModel.capabilities();
      status = caps.available;
    }

    if (!status) {
      return {
        isNanoAvailable: false,
        availabilityStatus: 'unsupported_browser',
        recommendedRoute: 'local_deterministic',
        diagnosticMessage:
          'Chrome built-in Prompt API not detected. Enable chrome://flags/#prompt-api-for-gemini-nano-multimodal-input to activate on-device inference.',
      };
    }

    const isAvailable = status === 'available' || status === 'readily';
    const isDownloading = status === 'after-download' || status === 'downloading';

    if (isAvailable) {
      return {
        isNanoAvailable: true,
        availabilityStatus: 'available',
        recommendedRoute: 'on_device',
        diagnosticMessage: 'Gemini Nano is active and verified available in this Chrome session.',
      };
    }

    if (isDownloading) {
      return {
        isNanoAvailable: false,
        availabilityStatus: 'after-download',
        recommendedRoute: 'local_deterministic',
        diagnosticMessage: 'Gemini Nano model download in progress on this device.',
      };
    }

    return {
      isNanoAvailable: false,
      availabilityStatus: 'no',
      recommendedRoute: 'local_deterministic',
      diagnosticMessage: 'Gemini Nano is unsupported on this hardware profile.',
    };
  } catch (error) {
    return {
      isNanoAvailable: false,
      availabilityStatus: 'no',
      recommendedRoute: 'local_deterministic',
      diagnosticMessage: `Calibration error: ${String(error)}`,
    };
  }
}
