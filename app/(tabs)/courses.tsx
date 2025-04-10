import { StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useContext, useState } from 'react';

import { Collapsible } from '@/components/Collapsible';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { AppContext } from '@/context/AppContext';
import { Course, AttendanceRecord } from '@/types';

export default function CoursesScreen() {
  const { courses, markAttendance } = useContext(AppContext);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourseId(expandedCourseId === courseId ? null : courseId);
  };

  const handleMarkAttendance = (courseId: string, status: 'present' | 'absent' | 'cancelled') => {
    Alert.alert(
      "Mark Attendance",
      `Mark this class as ${status}?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Regular Class",
          onPress: () => markAttendance(courseId, status, false)
        },
        {
          text: "Extra Class",
          onPress: () => markAttendance(courseId, status, true)
        }
      ]
    );
  };

  const calculateAttendancePercentage = (course: Course) => {
    const totalClasses = (course.presents || 0) + (course.absents || 0);
    if (totalClasses === 0) return 0;
    return Math.round((course.presents || 0) / totalClasses * 100);
  };

  const renderCourseItem = ({ item }: { item: Course }) => {
    const attendancePercentage = calculateAttendancePercentage(item);
    const isExpanded = expandedCourseId === item.id;
    
    return (
      <ThemedView style={styles.courseCard}>
        <TouchableOpacity onPress={() => toggleCourseExpand(item.id)}>
          <ThemedView style={styles.courseHeader}>
            <ThemedView>
              <ThemedText type="subtitle">{item.name}</ThemedText>
              <ThemedText>
                Attendance: {attendancePercentage}% ({item.presents || 0}/{(item.presents || 0) + (item.absents || 0)})
              </ThemedText>
              <ThemedText>
                Required: {item.requiredAttendance}%
              </ThemedText>
            </ThemedView>
            <IconSymbol
              name={isExpanded ? "chevron.up" : "chevron.down"}
              size={24}
              color="#808080"
            />
          </ThemedView>
        </TouchableOpacity>
        
        {isExpanded && (
          <ThemedView style={styles.expandedContent}>
            <ThemedView style={styles.attendanceActions}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.presentButton]}
                onPress={() => handleMarkAttendance(item.id, 'present')}
              >
                <ThemedText style={styles.actionButtonText}>Present</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.absentButton]}
                onPress={() => handleMarkAttendance(item.id, 'absent')}
              >
                <ThemedText style={styles.actionButtonText}>Absent</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelledButton]}
                onPress={() => handleMarkAttendance(item.id, 'cancelled')}
              >
                <ThemedText style={styles.actionButtonText}>Cancelled</ThemedText>
              </TouchableOpacity>
            </ThemedView>
            
            <ThemedText type="subtitle" style={styles.sectionTitle}>Attendance History</ThemedText>
            {item.attendanceRecords && item.attendanceRecords.length > 0 ? (
              <FlatList
                data={[...item.attendanceRecords].reverse()}
                keyExtractor={(record) => record.id}
                renderItem={({ item: record }) => (
                  <ThemedView style={styles.historyItem}>
                    <ThemedText>{new Date(record.data).toLocaleDateString()}</ThemedText>
                    <ThemedView 
                      style={[
                        styles.statusBadge,
                        record.Status === 'present' ? styles.presentBadge : 
                        record.Status === 'absent' ? styles.absentBadge : styles.cancelledBadge
                      ]}
                    >
                      <ThemedText style={styles.statusText}>
                        {record.Status.charAt(0).toUpperCase() + record.Status.slice(1)}
                        {record.isExtraClass ? ' (Extra)' : ''}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                )}
                style={styles.historyList}
              />
            ) : (
              <ThemedText style={styles.emptyText}>No attendance records yet</ThemedText>
            )}
          </ThemedView>
        )}
      </ThemedView>
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">My Courses</ThemedText>
      </ThemedView>
      
      {courses.length > 0 ? (
        <FlatList
          data={courses}
          renderItem={renderCourseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.coursesList}
          scrollEnabled={false}
        />
      ) : (
        <ThemedView style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>No courses added yet</ThemedText>
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  coursesList: {
    gap: 16,
  },
  courseCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedContent: {
    marginTop: 16,
    gap: 16,
  },
  attendanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  presentButton: {
    backgroundColor: '#4CAF50',
  },
  absentButton: {
    backgroundColor: '#F44336',
  },
  cancelledButton: {
    backgroundColor: '#9E9E9E',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 8,
  },
  historyList: {
    maxHeight: 200,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  presentBadge: {
    backgroundColor: '#E8F5E9',
  },
  absentBadge: {
    backgroundColor: '#FFEBEE',
  },
  cancelledBadge: {
    backgroundColor: '#EEEEEE',
  },
  statusText: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
});
