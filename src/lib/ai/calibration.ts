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
    const promptApi = (window as unknown as { LanguageModel?: { availability: () => Promise<string> } }).LanguageModel;
    const legacyAi = (window as unknown as { ai?: { languageModel?: { capabilities: () => Promise<{ available: string }> } } }).ai;

    let status = 'no';

    if (promptApi && typeof promptApi.availability === 'function') {
      status = await promptApi.availability();
    } else if (legacyAi?.languageModel && typeof legacyAi.languageModel.capabilities === 'function') {
      const caps = await legacyAi.languageModel.capabilities();
      status = caps.available;
    } else {
      return {
        isNanoAvailable: false,
        availabilityStatus: 'unsupported_browser',
        recommendedRoute: 'local_deterministic',
        diagnosticMessage:
          'Chrome built-in Prompt API not detected. Airlock will route to zero-AI deterministic local extraction with manual snippet approval.',
      };
    }

    const isAvailable = status === 'available' || status === 'readily';
    const isDownloading = status === 'after-download';

    if (isAvailable) {
      return {
        isNanoAvailable: true,
        availabilityStatus: 'available',
        recommendedRoute: 'on_device',
        diagnosticMessage: 'Gemini Nano is active and verified on this device. Full on-device private extraction enabled.',
      };
    }

    if (isDownloading) {
      return {
        isNanoAvailable: false,
        availabilityStatus: 'after-download',
        recommendedRoute: 'local_deterministic',
        diagnosticMessage: 'Gemini Nano model download in progress on this device. Routing to local deterministic extraction while downloading.',
      };
    }

    return {
      isNanoAvailable: false,
      availabilityStatus: 'no',
      recommendedRoute: 'local_deterministic',
      diagnosticMessage: 'Local Gemini Nano is unsupported on this hardware/browser profile. Using secure deterministic local extraction.',
    };
  } catch (error) {
    return {
      isNanoAvailable: false,
      availabilityStatus: 'no',
      recommendedRoute: 'local_deterministic',
      diagnosticMessage: `Calibration probe error: ${String(error)}`,
    };
  }
}

