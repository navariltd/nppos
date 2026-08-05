/**
 * useCamera – reusable camera permission + scanner lifecycle hook for the
 * NPPOS offline-first PWA.
 *
 * Follows the recommended pattern: camera access is requested only when the
 * user performs an action that needs it (e.g. tapping "Scan Voucher"), never
 * on page load. The hook manages permission state, starts/stops the
 * html5-qrcode scanner against a given element id, and releases the camera on
 * cleanup.
 *
 * Consumers render a scan button and the reader `<div id={elementId} />`,
 * then call `requestAndStart()` from the button's onClick handler. The hook
 * polls for the reader element before starting so mount timing doesn't matter.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type CameraPermission = "granted" | "denied" | "prompt" | "unavailable";

interface UseCameraResult {
  /** Current camera permission state. */
  permission: CameraPermission;
  /** True while the scanner is actively decoding frames. */
  isActive: boolean;
  /** Last error message, if any. */
  error: string | null;
  /** True when the last failure was a permission denial. */
  isPermissionDenied: boolean;
  /** True while obtaining permission / starting the stream. */
  isStarting: boolean;
  /** Call with the decoded QR/barcode text (set this each render). */
  setScanHandler: (cb: (value: string) => void) => void;
  /** Request camera permission via a user gesture, then start scanning. */
  requestAndStart: () => Promise<void>;
  /** Start the scanner against the reader element (no permission request). */
  start: () => Promise<void>;
  /** Stop and release the scanner/camera. */
  stop: () => Promise<void>;
}

/** True when the thrown error indicates the camera permission was denied. */
function isPermissionError(err: unknown): boolean {
  if (err instanceof DOMException) {
    // code 1 == DOMException.PERMISSION_DENIED_ERR (NotAllowedError).
    return err.name === "NotAllowedError" || err.code === 1;
  }
  if (err instanceof Error) {
    return err.name === "NotAllowedError";
  }
  return false;
}

/**
 * useCamera – manages camera permission and the QR/barcode scanner lifecycle.
 *
 * @param elementId - the id of the reader div html5-qrcode uses
 * @returns {UseCameraResult} permission state + start/stop/request methods
 */
export function useCamera(elementId = "nppos-camera-reader"): UseCameraResult {
  const [permission, setPermission] = useState<CameraPermission>("prompt");
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<any>(null);
  const onScanRef = useRef<(value: string) => void>(() => {});
  const elementIdRef = useRef(elementId);

  const setScanHandler = useCallback((cb: (value: string) => void) => {
    onScanRef.current = cb;
  }, []);

  const stop = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Camera already released or never started.
      }
      scannerRef.current = null;
    }
    setIsActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setIsPermissionDenied(false);
    setIsStarting(true);

    // Wait until the reader element is actually mounted; html5-qrcode throws a
    // "video element not found" error otherwise. Poll up to ~800ms.
    const id = elementIdRef.current;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (document.getElementById(id)) break;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    if (!document.getElementById(id)) {
      setError("Camera view is not ready. Please try again.");
      setIsStarting(false);
      return;
    }

    const Html5Qrcode = (await import("html5-qrcode")).Html5Qrcode;
    const scanner = new Html5Qrcode(id);

    const onSuccess = (decodedText: string) => {
      onScanRef.current(decodedText.trim());
      // Stop scanning once a code is captured.
      void stop();
    };

    const onFailure = () => {
      // Ignore per-frame failures; keep scanning.
    };

    try {
      // Passing MediaTrackConstraints lets html5-qrcode acquire its own stream;
      // a NotAllowedError here surfaces as a permission denial.
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 200 } },
        onSuccess,
        onFailure,
      );
      scannerRef.current = scanner;
      setPermission("granted");
      setIsActive(true);
    } catch (err) {
      if (isPermissionError(err)) {
        setPermission("denied");
        setIsPermissionDenied(true);
        setError(
          "Camera access is blocked. Click “Allow camera access” to open the permission prompt.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not start camera. Click “Allow camera access” to try again.",
        );
      }
    } finally {
      setIsStarting(false);
    }
  }, [stop]);

  const requestAndStart = useCallback(async () => {
    setError(null);
    setIsPermissionDenied(false);
    setIsStarting(true);
    try {
      // getUserMedia in this user-gesture handler is the definitive way to
      // request access (and to re-prompt after a denial). We only use the
      // short-lived stream to confirm/grant permission; the scanner acquires
      // its own stream, so this one is released immediately.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermission("granted");
      setIsStarting(false);
      await start();
    } catch (err) {
      setIsStarting(false);
      if (isPermissionError(err)) {
        setPermission("denied");
        setIsPermissionDenied(true);
        setError(
          "Camera permission was not granted. Click “Allow camera access” to open the permission prompt.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not access the camera. Try again.",
        );
      }
    }
  }, [start]);

  // Read the current permission where the Permissions API is supported
  // (Chromium). Safari lacks camera permission query support; getUserMedia in
  // requestAndStart remains the authoritative request path.
  useEffect(() => {
    if (typeof navigator.permissions?.query !== "function") return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "camera" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        if (status.state !== "prompt") {
          setPermission(status.state as CameraPermission);
        }
      })
      .catch(() => {
        // Query unsupported/errored — fall back to getUserMedia on demand.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Release the camera when the consumer unmounts.
  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return {
    permission,
    isActive,
    error,
    isPermissionDenied,
    isStarting,
    setScanHandler,
    requestAndStart,
    start,
    stop,
  };
}