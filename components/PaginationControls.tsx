import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';

interface PaginationControlsProps {
  currentPage: number;
  totalRecords: number;
  recordsPerPage: number;
  onPageChange: (page: number) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalRecords,
  recordsPerPage,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const colorScheme = useColorScheme() ?? 'light';

  if (totalPages <= 1) {
    return null;
  }

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePrev}
        disabled={currentPage === 1}
        style={[styles.button, { opacity: currentPage === 1 ? 0.5 : 1 }]}
      >
        <Ionicons name="chevron-back" size={24} color={Colors[colorScheme].text} />
      </TouchableOpacity>
      <ThemedText style={styles.pageInfo}>
        Page {currentPage} of {totalPages}
      </ThemedText>
      <TouchableOpacity
        onPress={handleNext}
        disabled={currentPage === totalPages}
        style={[styles.button, { opacity: currentPage === totalPages ? 0.5 : 1 }]}
      >
        <Ionicons name="chevron-forward" size={24} color={Colors[colorScheme].text} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  button: {
    paddingHorizontal: 10,
  },
  pageInfo: {
    marginHorizontal: 15,
    fontSize: 16,
  },
});

export default PaginationControls;
