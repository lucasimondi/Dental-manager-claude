export const MOBILE_PORTRAIT_MAX_WIDTH = 719;
export const MOBILE_LANDSCAPE_MAX_WIDTH = 1024;
export const MOBILE_LANDSCAPE_MAX_HEIGHT = 600;

/* POL-UI-017 R1 shell-mode contract:
   - narrow viewports remain mobile as before;
   - a coarse-pointer, short landscape viewport remains mobile up to 1024px;
   - 768x1024 tablets and desktop/fine-pointer windows retain the desktop shell.
   No user-agent sniffing and no device-name assumptions. */
export function getMobileShellMode({ width, height, coarsePointer = false, portraitBreakpoint = MOBILE_PORTRAIT_MAX_WIDTH + 1 } = {}) {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (!Number.isFinite(safeWidth) || !Number.isFinite(safeHeight)) return true;
  if (safeWidth < portraitBreakpoint) return true;
  return Boolean(
    coarsePointer &&
    safeWidth <= MOBILE_LANDSCAPE_MAX_WIDTH &&
    safeHeight <= MOBILE_LANDSCAPE_MAX_HEIGHT
  );
}
