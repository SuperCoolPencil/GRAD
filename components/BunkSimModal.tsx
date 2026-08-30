import React from 'react';
import { View, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { BaseModal } from './BaseModal';
import { ThemedText } from './ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import type { BunkSimulationResult } from '@/utils/attendance';

interface BunkSimModalProps {
  isVisible: boolean;
  onClose: () => void;
  courseName: string;
  simulation: BunkSimulationResult;
  onPlanBunk?: () => void;
  isAlreadyPlanned?: boolean;
  sessionLabel?: string;
}

export function BunkSimModal({ isVisible, onClose, courseName, simulation, onPlanBunk, isAlreadyPlanned = false, sessionLabel }: BunkSimModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const safeColor = Colors[colorScheme].success;
  const riskyColor = Colors[colorScheme].error;
  const accentColor = simulation.isSafe ? safeColor : riskyColor;

  const footer = (
    <Pressable
      style={({ pressed }) => [
        bunkStyles.button,
        { backgroundColor: accentColor, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPlanBunk || onClose}
    >
      <ThemedText style={bunkStyles.buttonText}>{onPlanBunk ? (isAlreadyPlanned ? 'Already planned' : 'Plan to bunk this class') : 'Got it'}</ThemedText>
    </Pressable>
  );

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      dismissOnBackdropPress
      footer={footer}
    >
      {/* Header icon + title */}
      <View style={bunkStyles.headerRow}>
        <View style={[bunkStyles.iconWrap, { backgroundColor: accentColor + '22' }]}>
          <Ionicons
            name={simulation.isSafe ? 'shield-checkmark' : 'warning'}
            size={28}
            color={accentColor}
          />
        </View>
        <View style={bunkStyles.headerText}>
          <ThemedText style={bunkStyles.title}>Bunk Simulator</ThemedText>
          <ThemedText style={[bunkStyles.subtitle, { color: Colors[colorScheme].icon }]}>
            {sessionLabel ? `${courseName} · ${sessionLabel}` : courseName}
          </ThemedText>
        </View>
      </View>

      {/* Percentage change display */}
      <View style={[bunkStyles.percentRow, { backgroundColor: Colors[colorScheme].cardBackground }]}>
        <View style={bunkStyles.percentBlock}>
          <ThemedText style={[bunkStyles.percentLabel, { color: Colors[colorScheme].icon }]}>Now</ThemedText>
          <ThemedText style={bunkStyles.percentValue}>{simulation.currentPercentage}%</ThemedText>
        </View>

        <View style={bunkStyles.arrowBlock}>
          <Ionicons name="arrow-forward" size={20} color={accentColor} />
        </View>

        <View style={bunkStyles.percentBlock}>
          <ThemedText style={[bunkStyles.percentLabel, { color: Colors[colorScheme].icon }]}>If Bunked</ThemedText>
          <ThemedText style={[bunkStyles.percentValue, { color: accentColor }]}>
            {simulation.simulatedPercentage}%
          </ThemedText>
        </View>
      </View>

      {/* Status pill */}
      <View style={[bunkStyles.statusPill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
        <Ionicons
          name={simulation.isSafe ? 'checkmark-circle' : 'alert-circle'}
          size={15}
          color={accentColor}
          style={{ marginRight: 6 }}
        />
        <ThemedText style={[bunkStyles.statusText, { color: accentColor }]}>
          {simulation.message}
        </ThemedText>
      </View>

      <View style={[bunkStyles.targetDate, { backgroundColor: Colors[colorScheme].cardBackground }]}>
        <Ionicons name="calendar-outline" size={18} color={accentColor} />
        <View style={bunkStyles.targetDateText}>
          <ThemedText style={[bunkStyles.targetDateLabel, { color: Colors[colorScheme].icon }]}>New target date</ThemedText>
          <ThemedText style={bunkStyles.targetDateValue}>
            {simulation.targetDate
              ? simulation.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : simulation.targetMessage}
          </ThemedText>
        </View>
      </View>

      {/* Note about planned skip days */}
      <ThemedText style={[bunkStyles.note, { color: Colors[colorScheme].icon }]}>
        {onPlanBunk
          ? 'This only skips this class. To skip every class on a date, use the day header.'
          : '“Now” reflects your effective attendance including planned skip days.'}
      </ThemedText>
    </BaseModal>
  );
}

const bunkStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  percentBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  arrowBlock: {
    paddingHorizontal: 12,
  },
  percentLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  percentValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 42,
    includeFontPadding: false,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    flex: 1,
  },
  targetDate: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  targetDateText: {
    marginLeft: 10,
    flex: 1,
  },
  targetDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  targetDateValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
