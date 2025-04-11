import React, { useState, useContext } from 'react';
import { View, TextInput, StyleSheet, Alert, useColorScheme, TouchableOpacity, Platform } from 'react-native'; // Added TouchableOpacity, Platform
import Constants from 'expo-constants'; // Added Constants
import { AppContext } from '@/context/AppContext'; // Updated path
import { Colors } from '@/constants/Colors'; // Updated path
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Ionicons from '@expo/vector-icons/Ionicons'; // Added for potential icons if needed later
import { useRouter } from 'expo-router'; // Added for potential navigation back

const AddExtraClassScreen = () => {
  const router = useRouter(); // Added router
  const { courses, addExtraClass } = useContext(AppContext);
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const colorScheme = useColorScheme() ?? 'light';
  const styles = getStyles(colorScheme); // Generate styles based on theme

  const handleSubmit = async () => { // Made async for potential future async operations
    if (!courseId || !date || !timeStart || !timeEnd) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    try {
      await addExtraClass(courseId, date, timeStart, timeEnd); // Assuming addExtraClass might become async
      Alert.alert("Success", "Extra class added!");
      // Optionally navigate back or clear form
      setCourseId("");
      setDate("");
      setTimeStart("");
      setTimeEnd("");
      // router.back(); // Example: navigate back after success
    } catch (error) {
      console.error("Failed to add extra class:", error);
      Alert.alert("Error", "Failed to add extra class. Please try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
      {/* Consistent Title Container */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{ color: Colors[colorScheme].text }}>
          Add Extra Class
        </ThemedText>
        {/* Optional: Add a close/back button if needed */}
        {/* <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close-circle-outline" size={28} color={Colors[colorScheme].text} />
        </TouchableOpacity> */}
      </ThemedView>

      {/* Form Content */}
      <ThemedView style={styles.contentContainer}>
        <ThemedText style={styles.label}>Course ID:</ThemedText>
        <TextInput
          style={styles.input}
          value={courseId}
          onChangeText={setCourseId}
          placeholder="Enter Course ID (e.g., CS101)"
          placeholderTextColor={Colors[colorScheme].placeholder}
          keyboardType="default" // Adjust keyboard type if needed
          autoCapitalize="characters"
      />

      <ThemedText style={styles.label}>Date (YYYY-MM-DD):</ThemedText>
      <TextInput
        style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors[colorScheme].placeholder}
          keyboardType="numeric" // Or default if slashes are needed
      />

      <ThemedText style={styles.label}>Start Time (HH:MM 24-hour):</ThemedText>
      <TextInput
        style={styles.input}
          value={timeStart}
          onChangeText={setTimeStart}
          placeholder="HH:MM (e.g., 14:00)"
          placeholderTextColor={Colors[colorScheme].placeholder}
          keyboardType="numbers-and-punctuation" // Or default
      />

      <ThemedText style={styles.label}>End Time (HH:MM 24-hour):</ThemedText>
      <TextInput
        style={styles.input}
          value={timeEnd}
          onChangeText={setTimeEnd}
          placeholder="HH:MM (e.g., 15:30)"
          placeholderTextColor={Colors[colorScheme].placeholder}
          keyboardType="numbers-and-punctuation" // Or default
      />

        {/* Themed Button */}
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <ThemedText style={styles.buttonText}>Add Extra Class</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </View>
  );
};

// Function to generate theme-aware styles
const getStyles = (colorScheme: 'light' | 'dark') => StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Adjust as needed (e.g., 'flex-start' if no close button)
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight + 16 : 16,
    paddingBottom: 16, // Consistent padding
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    // Removed justifyContent: 'center'
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: Colors[colorScheme].text,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors[colorScheme].border, // Themed border
    backgroundColor: Colors[colorScheme].inputBackground, // Themed input background
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: Colors[colorScheme].text, // Themed text color
  },
  button: {
    backgroundColor: Colors[colorScheme].tint, // Themed button background
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10, // Add some margin top
  },
  buttonText: {
    color: Colors[colorScheme].buttonText || '#FFFFFF', // Themed button text (default white)
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Optional: Style for a close button if added
  // closeButton: {
  //   padding: 4,
  // },
});

export default AddExtraClassScreen;
