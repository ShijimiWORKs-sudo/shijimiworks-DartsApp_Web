import { Platform, Text, View } from 'react-native';

import { buildWebStartupErrorDetails } from '../features/web/startupError';
import type { WebStartupErrorStage } from '../features/web/startupError';

type WebStartupErrorBoundaryProps = {
  error: unknown;
  stage: WebStartupErrorStage;
};

export function WebStartupErrorBoundary({ error, stage }: WebStartupErrorBoundaryProps) {
  const details = buildWebStartupErrorDetails(error, stage);
  const showDeveloperDetails = __DEV__;

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          borderRadius: 8,
          backgroundColor: '#7f1d1d',
          padding: 12,
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '700' }}>{details.message}</Text>
        <Text style={{ color: '#fee2e2', marginTop: 4 }}>{details.developerMessage}</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: 24,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 8,
          borderColor: '#fecaca',
          borderWidth: 1,
          backgroundColor: '#ffffff',
          padding: 20,
        }}
      >
        <Text style={{ color: '#7f1d1d', fontSize: 20, fontWeight: '700' }}>{details.title}</Text>
        <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600', marginTop: 12 }}>
          {details.message}
        </Text>
        <Text style={{ color: '#374151', fontSize: 14, marginTop: 8 }}>
          {details.recoveryAction}
        </Text>
        {showDeveloperDetails ? (
          <View
            style={{
              borderTopColor: '#e5e7eb',
              borderTopWidth: 1,
              marginTop: 16,
              paddingTop: 12,
            }}
          >
            <Text style={{ color: '#4b5563', fontSize: 12 }}>stage: {details.stage}</Text>
            <Text style={{ color: '#4b5563', fontSize: 12 }}>error: {details.developerName}</Text>
            <Text style={{ color: '#4b5563', fontSize: 12 }}>{details.developerMessage}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
