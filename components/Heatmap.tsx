import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, Text, useColorScheme } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';

interface HeatmapComponentProps {
  data: { date: Date; value: number }[];
}

const CELL_SIZE = 20;
const CELL_MARGIN = 4;
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper function to convert hex color to an RGB object
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const HeatmapComponent = ({ data }: HeatmapComponentProps) => {
  const { colors } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];

  const { columns } = useMemo(() => {
    if (!data || data.length === 0) {
      return { columns: [] };
    }

    const firstDate = data[0].date;
    const dayOfWeek = firstDate.getDay(); // 0 = Sunday

    const numericData = data.map(d => d.value);
    const paddedData = [...Array(dayOfWeek).fill(-2), ...numericData]; // -2 for padding

    const chunkedColumns = [];
    for (let i = 0; i < paddedData.length; i += 7) {
      chunkedColumns.push(paddedData.slice(i, i + 7));
    }
    return { columns: chunkedColumns };
  }, [data]);

  const getCellStyle = (value: number) => {
    if (value === -2) {
      return styles.paddingCell; // Padding cell
    }
    if (value === -1) {
      return [styles.cell, { borderColor: colors.border, borderWidth: 1 }]; // No class
    }
    if (value === 100) {
      return [styles.cell, { backgroundColor: themeColors.success }]; // Perfect attendance
    }
    
    // For partial attendance, use the theme's error color with opacity
    const rgbErrorColor = hexToRgb(themeColors.error);
    if (rgbErrorColor) {
      const opacity = Math.max(0.1, value / 100);
      return [styles.cell, { backgroundColor: `rgba(${rgbErrorColor.r}, ${rgbErrorColor.g}, ${rgbErrorColor.b}, ${opacity})` }];
    }

    // Fallback style
    return [styles.cell, { borderColor: colors.border, borderWidth: 1 }];
  };

  return (
    <View style={styles.container}>
      <View style={styles.weekdaysContainer}>
        {WEEK_DAYS.map(day => (
          <Text key={day} style={[styles.weekday, { color: colors.text }]}>{day}</Text>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {columns.map((column, colIndex) => (
            <View key={colIndex} style={styles.column}>
              {column.map((value, rowIndex) => (
                <View key={rowIndex} style={getCellStyle(value)} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  weekdaysContainer: {
    marginRight: 10,
    alignItems: 'flex-start',
  },
  weekday: {
    height: CELL_SIZE,
    lineHeight: CELL_SIZE,
    marginVertical: CELL_MARGIN / 2,
    fontSize: 12,
  },
  gridContainer: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
    marginHorizontal: CELL_MARGIN / 2,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 4,
    marginVertical: CELL_MARGIN / 2,
  },
  paddingCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginVertical: CELL_MARGIN / 2,
  },
});

export default HeatmapComponent;
