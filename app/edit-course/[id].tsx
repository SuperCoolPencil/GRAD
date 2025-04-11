import React from 'react';
import { StyleSheet, View, Button } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function EditCourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Fetch course data based on id here later

  return (
    <>
      <Stack.Screen options={{ title: `Edit Course ${id}` }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">Edit Course</ThemedText>
        <ThemedText>Editing form for course {id} will go here.</ThemedText>
        {/* Placeholder for form elements */}
        <Button title="Save Changes (Placeholder)" onPress={() => router.back()} />
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
