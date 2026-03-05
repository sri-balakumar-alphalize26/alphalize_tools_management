import React from 'react';
import { View, ScrollView } from 'react-native';
import { COLORS } from '@constants/theme';

const RoundedScrollContainer = ({
  children,
  backgroundColor = COLORS.white,
  borderRadius = true,
  scrollEnabled = true,
  paddingHorizontal,
  borderTopLeftRadius,
  borderTopRightRadius,
}) => {
  const containerStyles = {
    flex: 1,
    paddingHorizontal: paddingHorizontal || 6,
    backgroundColor: backgroundColor,
    ...(borderRadius && {
      borderTopLeftRadius: borderTopLeftRadius || 15,
      borderTopRightRadius: borderTopRightRadius || 15,
    }),
  };

  return (
    <View style={containerStyles}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: borderRadius ? 15 : 0 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {children}
      </ScrollView>
    </View>
  );
};

export default RoundedScrollContainer;
