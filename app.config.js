// Android discovers its OAuth client from the registered package and signing certificate.
// iOS also needs the callback scheme compiled into its application bundle.
module.exports = ({ config }) => {
  const iosClient = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!iosClient) return config;
  if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(iosClient)) {
    throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be a Google iOS OAuth client ID.');
  }
  return {
    ...config,
    plugins: [...config.plugins, [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: iosClient.split('.').reverse().join('.') },
    ]],
  };
};
