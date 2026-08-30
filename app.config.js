module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // This is set by release builds and becomes available at runtime.
    production: process.env.PRODUCTION === '1',
  },
});
