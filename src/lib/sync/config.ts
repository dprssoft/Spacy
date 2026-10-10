/** Google OAuth client id (`PUBLIC_GOOGLE_CLIENT_ID` at build time). Empty: Drive sync is hidden. */
export const GOOGLE_CLIENT_ID: string = __GOOGLE_CLIENT_ID__.trim();
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const driveSyncAvailable = (): boolean => GOOGLE_CLIENT_ID !== '';
