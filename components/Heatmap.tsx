import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, Text, useColorScheme } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';

interface HeatmapData {
  date: Date;
  value: number;
  isHoliday: boolean;
  hasExtraClass: boolean;
}

interface HeatmapComponentProps {
  data: HeatmapData[];
}

const CELL_SIZE = 20;
const CELL_MARGIN = 4;
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

// Helper function to interpolate between two colors.
// It calculates a color between color1 and color2 based on a factor.
// A factor of 0 returns color1, a factor of 1 returns color2, and 0.5 returns a color halfway between.
const interpolateColor = (color1: string, color2: string, factor: number) => {
  // Convert HEX colors to RGB objects.
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (rgb1 && rgb2) {
    // Linearly interpolate each color channel (R, G, B).
    const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
    const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
    const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
    // Return the result as an RGB string.
    return `rgb(${r}, ${g}, ${b})`;
  }
  // Return null if color conversion fails.
  return null;
};

const HeatmapComponent = ({ data }: HeatmapComponentProps) => {
  const { colors } = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];

  const { columns, months } = useMemo(() => {
    if (!data || data.length === 0) {
      return { columns: [], months: [] };
    }

    const firstDate = data[0].date;
    const dayOfWeek = (firstDate.getDay() + 6) % 7;

    const processedData = data.map((d, i) => ({
      value: d.value,
      isHoliday: d.isHoliday,
      hasExtraClass: d.hasExtraClass,
    }));

    const paddedData = [...Array(dayOfWeek).fill({ value: -2, isFirstDayOfMonth: false }), ...processedData];

    const chunkedColumns = [];
    for (let i = 0; i < paddedData.length; i += 7) {
      chunkedColumns.push(paddedData.slice(i, i + 7));
    }

    const monthLabels: { name: string, columnCount: number }[] = [];
    let lastMonth = -1;
    let columnCount = 0;

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const month = d.date.getMonth();

      if (month !== lastMonth) {
        if (lastMonth !== -1) {
          monthLabels[monthLabels.length - 1].columnCount = columnCount;
        }
        monthLabels.push({ name: d.date.toLocaleString('default', { month: 'short' }), columnCount: 1 });
        lastMonth = month;
        columnCount = 1;
      } else {
        columnCount++;
      }
    }
    if (monthLabels.length > 0) {
      monthLabels[monthLabels.length - 1].columnCount = columnCount;
    }

    return { columns: chunkedColumns, months: monthLabels };
  }, [data]);

  // The day labels are rendered from the `displayWeekDays` array.
  // The data columns are constructed such that the first item in each column corresponds to the first day in `displayWeekDays`,
  // the second item to the second day, and so on.
  // The `paddedData` ensures that the first piece of actual data aligns with its correct day of the week.

  const getCellStyle = (item: HeatmapData) => {
    const { value, isHoliday, hasExtraClass } = item;
    const style: any[] = [styles.cell];

    if (value === -2) {
      return styles.paddingCell; // Padding cell
    }

    if (isHoliday && !hasExtraClass) {
      style.push({ backgroundColor: themeColors.tint }); // Blue for holidays without extra classes
    } else if (value === -1) {
      style.push({ backgroundColor: themeColors.border, opacity: 0.2 }); // Subtle fill for no class
    } else if (value === 100) {
      style.push({ backgroundColor: themeColors.success }); // Perfect attendance
    } else {
      // For partial attendance, calculate a color on a gradient from red to a lighter red.
      const startColor = '#ff0000'; // This is a deep red.
      const endColor = '#ffff00'; // A yellow.
      const factor = value / 100;
      const interpolatedColor = interpolateColor(startColor, endColor, factor);
      if (interpolatedColor) {
        style.push({ backgroundColor: interpolatedColor });
      } else {
        style.push({ borderColor: colors.border, borderWidth: 1 });
      }
    }

    return style;
  };

  return (
    <View style={styles.container}>
      <View style={styles.weekdaysContainer}>
        {WEEK_DAYS.map(day => (
          <Text key={day} style={[styles.weekday, { color: colors.text }]}>{day}</Text>
        ))}
      </View>
      <View>
        <View>
          <View style={styles.gridContainer}>
            {columns.map((column, colIndex) => (
              <View key={colIndex} style={styles.column}>
                {column.map((item, rowIndex) => (
                  <View key={rowIndex} style={getCellStyle(item)} />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.monthsContainer}>
            {months.map((month, index) => (
              <Text key={index} style={[styles.monthLabel, { color: colors.text, width: (CELL_SIZE + CELL_MARGIN) * (month.columnCount / 7) }]}>
                {month.name}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'flex-start',
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
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
  },
  monthsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  monthLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  column: {
    flexDirection: 'column',
    marginHorizontal: CELL_MARGIN / 2,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 3, // Softer, more modern rounding
    marginVertical: CELL_MARGIN / 2,
  },
  paddingCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginVertical: CELL_MARGIN / 2,
  },
});

export default HeatmapComponent;
