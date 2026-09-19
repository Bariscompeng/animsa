const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Free Apple IDs cannot sign push entitlements, and the app never uses remote
 * notifications. Strip `aps-environment` so the generated entitlements file stays
 * clean for unsigned CI builds and AltStore sideloading alike.
 */
const withStripPushEntitlement = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    delete cfg.modResults['com.apple.developer.aps-environment'];
    return cfg;
  });

module.exports = withStripPushEntitlement;
