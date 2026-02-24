/* eslint global-require: off, no-console: off */

'use strict';

module.exports = async function notarizeApp(context) {
  // ✅ Notarize solo aplica en macOS
  if (process.platform !== 'darwin') return;
  if (!context || context.electronPlatformName !== 'darwin') return;

  // ✅ Import dinámico: evita require() de un ESM
  const { notarize } = await import('@electron/notarize');

  const { appOutDir, packager } = context;
  const appName = packager.appInfo.productFilename;

  // Variables típicas para notarización (ajusta a tu setup)
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD; // app-specific password
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword) {
    console.log('[notarize] APPLE_ID / APPLE_ID_PASSWORD no configurados. Saltando notarización.');
    return;
  }

  console.log('[notarize] Notarizando…', appName);

  await notarize({
    appBundleId: packager.appInfo.id,
    appPath: `${appOutDir}\\${appName}.app`,
    appleId,
    appleIdPassword,
    teamId,
  });

  console.log('[notarize] OK');
};