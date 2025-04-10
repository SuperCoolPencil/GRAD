import React from 'react';
import { StyleSheet, View, Button } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function AddCourseScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Add New Course' }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">Add Course</ThemedText>
        <ThemedText>Form to add a new course will go here.</ThemedText>
        {/* Placeholder for form elements */}
        <Button title="Save Course (Placeholder)" onPress={() => router.back()} />
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
});
