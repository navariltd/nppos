/**
 * CameraScanner – an inline camera panel that reads a QR code or barcode and
 * passes the decoded text back to the caller.
 *
 * The camera is opened manually via an "Open camera" button (prompting for
 * permission when needed), decodes frames continuously, and stops once a value
 * is captured. When the camera cannot start (including a denied/blocked
 * permission) it shows clear guidance with "Allow camera access" / "Retry
 * camera" options.
 */
import { CameraOff, Info, RefreshCw, ScanLine, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/use-camera";

interface CameraScannerProps {
  /** Called with the decoded text once a QR/barcode is successfully read. */
  onScan: (value: string) => void;
  /** Disabled while a search is in progress. */
  disabled?: boolean;
}

/**
 * CameraScanner – an embedded QR/barcode scanner, opened manually.
 *
 * @param onScan - callback with the decoded value
 * @param disabled - disables the control while loading
 * @returns {JSX.Element} the inline camera panel
 */
export default function CameraScanner({ onScan, disabled }: CameraScannerProps) {
  const {
    isActive,
    error,
    isPermissionDenied,
    isStarting,
    setScanHandler,
    requestAndStart,
    start,
    stop,
  } = useCamera("nppos-camera-reader");
  const [hasOpened, setHasOpened] = useState(false);

  // Always route the latest scan result callback.
  useEffect(() => {
    setScanHandler(onScan);
  }, [onScan, setScanHandler]);

  return (
    <div className="w-full rounded-lg border bg-muted/30 p-3 max-w-sm">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5 shrink-0">
          <ScanLine className="h-4 w-4 text-primary" />
          Scan QR / barcode
        </p>
        {/* When scanning, allow stopping; when idle/captured, allow (re)starting */}
        {isActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setHasOpened(true);
              stop();
            }}
            disabled={disabled || isStarting}
            className="h-7 text-xs gap-1"
            aria-label="Close camera"
          >
            Close
          </Button>
        ) : (
          !error && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setHasOpened(true);
                void requestAndStart();
              }}
              disabled={disabled || isStarting}
              className="h-7 text-xs gap-1"
              aria-label="Open camera"
            >
              <ScanLine className="h-3 w-3" /> {hasOpened ? "Scan again" : "Open camera"}
            </Button>
          )
        )}
      </div>

      {/* Compact reader element — rendered while starting/active so the scanner
          can attach to it (the hook waits for it to be mounted). */}
      {(isStarting || isActive) && !error && (
        <div
          id="nppos-camera-reader"
          className="w-full overflow-hidden rounded-md bg-black"
        />
      )}

      {isStarting && !isActive && !error && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
          <Info className="h-3.5 w-3.5" />
          Opening camera… please allow permission when prompted.
        </p>
      )}

      {/* Idle state after a scan captured (or before first open) */}
      {!isStarting && !isActive && !error && (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          {hasOpened
            ? "Scan complete. Tap “Scan again” to capture another voucher."
            : "Tap “Open camera” to start scanning."}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
          <div className="flex items-start gap-2">
            {isPermissionDenied ? (
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            ) : (
              <CameraOff className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-destructive">
                {isPermissionDenied
                  ? "Camera access blocked"
                  : "Could not start camera"}
              </p>
              <p className="text-sm text-destructive/90">{error}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setHasOpened(true);
                void requestAndStart();
              }}
              disabled={disabled || isStarting}
              className="gap-1.5"
            >
              <ScanLine className="h-4 w-4" /> Allow camera access
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setHasOpened(true);
                void start();
              }}
              disabled={disabled || isStarting}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" /> Retry camera
            </Button>
          </div>
          {isPermissionDenied && (
            <p className="text-xs text-muted-foreground">
              If the permission prompt doesn't appear, check your browser's site
              settings and allow camera access for this site, then try again.
            </p>
          )}
        </div>
      )}

      {/* Active camera hint */}
      {isActive && !error && (
        <p className="text-xs text-muted-foreground mt-2">
          Point the camera at a QR code or barcode. Scanning stops
          automatically once a code is captured.
        </p>
      )}
    </div>
  );
}
