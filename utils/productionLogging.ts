import Constants from 'expo-constants';

const isProductionBuild = Constants.expoConfig?.extra?.production === true;

// Release builds should not spend time formatting and forwarding verbose app logs.
// Keep errors intact so production failures remain diagnosable.
if (isProductionBuild) {
  console.log = () => undefined;
  console.info = () => undefined;
  console.debug = () => undefined;
  console.warn = () => undefined;
}
