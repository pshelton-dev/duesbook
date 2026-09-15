/**
 * expo-router asks this before navigating to a URL the OS handed the app.
 * A books file opened from Files, Mail, or AirDrop arrives as a file URL;
 * that is not a route, so send the router Home and let
 * OpenedBooksFileHandler (which reads the raw URL via expo-linking) offer
 * the restore.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('file:') || /\.(duesbook|db)(\?.*)?$/i.test(path)) return '/'
  return path
}
