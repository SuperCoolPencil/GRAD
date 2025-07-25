import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HeatMap, { ColorProps } from '@ncuhomeclub/react-native-heatmap';
import { useTheme } from '@react-navigation/native';

interface HeatmapComponentProps {
  data: number[];
}

const HeatmapComponent = ({ data }: HeatmapComponentProps) => {
  const { colors } = useTheme();

  const outlineData = data.map(d => (d === 0 ? 1 : 0));
  const outlineColor: ColorProps = {
    theme: colors.border,
    opacitys: [
      { limit: 0, opacity: 0 },
      { limit: 1, opacity: 1 },
    ],
  };

  const redData = data.map(d => (d >= 1 && d <= 100 ? d : 0));
  const redColor: ColorProps = {
    theme: '#ff0000',
    opacitys: Array.from({ length: 100 }, (_, i) => ({
      limit: i + 1,
      opacity: (i + 1) / 100,
    })),
  };

  const greenData = data.map(d => (d === 101 ? 1 : 0));
  const greenColor: ColorProps = {
    theme: '#00C853',
    opacitys: [
      { limit: 0, opacity: 0 },
      { limit: 1, opacity: 1 },
    ],
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Layer 1: Outlines for no-class days */}
          <HeatMap data={outlineData} color={outlineColor} direction='horizontal' shape='circle' />
          
          {/* Layer 2: Red shades for <100% attendance */}
          <View style={styles.overlay}>
            <HeatMap data={redData} color={redColor} direction='horizontal' shape='circle' />
          </View>

          {/* Layer 3: Green for 100% attendance */}
          <View style={styles.overlay}>
            <HeatMap data={greenData} color={greenColor} direction='horizontal' shape='circle' />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});

export default HeatmapComponent;
