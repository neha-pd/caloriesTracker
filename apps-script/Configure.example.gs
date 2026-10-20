// Run once in the Apps Script project as its owner, then remove this file.
function configureFitkin() {
  const config = {
    OWNER_EMAIL: 'YOUR_OWNER_EMAIL',
    FIREBASE_PROJECT_ID: 'YOUR_FIREBASE_PROJECT_ID',
    FIREBASE_API_KEY: 'YOUR_FIREBASE_WEB_API_KEY'
    // Optional: OPENROUTER_API_KEY: 'YOUR_FREE_ONLY_KEY'
  };
  if (Session.getActiveUser().getEmail().toLowerCase() !== config.OWNER_EMAIL.toLowerCase()) {
    throw new Error('Open this private script as its configured owner.');
  }
  PropertiesService.getScriptProperties().setProperties(config, false);
}
