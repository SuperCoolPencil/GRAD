import React, { useContext } from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { ThemedText } from './ThemedText';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppContext } from '../context/AppContext';

const TopBar = () => {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const { theme } = useContext(AppContext);

  return (
    <View style={[styles.topBar, { backgroundColor: colorScheme === 'dark' ? '#1E1E1E' : '#F2F2F2' }]}>
      <ThemedText style={styles.appName}>GRAD</ThemedText>
      <TouchableOpacity onPress={() => navigation.navigate('Settings' as never)}>
        <Ionicons name="settings-outline" size={28} color='#8ec5ff'/>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8ec5ff',
  },
});



export default TopBar;
