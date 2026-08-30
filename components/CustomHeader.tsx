import React from 'react';
import { View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { ThemedText } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CustomHeaderProps {
  title: string;
  rightElement?: React.ReactNode;
}

const CustomHeader = ({ title, rightElement }: CustomHeaderProps) => {
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <SafeAreaView edges={['top']} style={{ 
      backgroundColor: Colors[colorScheme].card,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    }}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
        {rightElement && (
          <View style={styles.rightElementContainer}>
            {rightElement}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  rightElementContainer: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default CustomHeader;
