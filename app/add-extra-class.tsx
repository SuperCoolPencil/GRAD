import React, { useState, useContext } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { AppContext } from '../context/AppContext';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const AddExtraClassScreen = () => {
  const { courses, addExtraClass } = useContext(AppContext);
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const colorScheme = useColorScheme() ?? 'light';

  const handleSubmit = () => {
    if (!courseId || !date || !timeStart || !timeEnd) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    addExtraClass(courseId, date, timeStart, timeEnd);
    Alert.alert("Success", "Extra class added!");
    setCourseId("");
    setDate("");
    setTimeStart("");
    setTimeEnd("");
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.label}>Course ID:</ThemedText>
      <TextInput
        style={styles.input}
        value={courseId}
        onChangeText={setCourseId}
        placeholder="Enter Course ID"
        placeholderTextColor={Colors[colorScheme].text}
      />

      <ThemedText style={styles.label}>Date (YYYY-MM-DD):</ThemedText>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={Colors[colorScheme].text}
      />

      <ThemedText style={styles.label}>Start Time (HH:MM):</ThemedText>
      <TextInput
        style={styles.input}
        value={timeStart}
        onChangeText={setTimeStart}
        placeholder="HH:MM"
        placeholderTextColor={Colors[colorScheme].text}
      />

      <ThemedText style={styles.label}>End Time (HH:MM):</ThemedText>
      <TextInput
        style={styles.input}
        value={timeEnd}
        onChangeText={setTimeEnd}
        placeholder="HH:MM"
        placeholderTextColor={Colors[colorScheme].text}
      />

      <Button title="Add Extra Class" onPress={handleSubmit} />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
});

export default AddExtraClassScreen;
