import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useHaptics } from './useHaptics';
import { useSettings } from './SettingsProvider';

/** Take or choose a photo, then hand it to the analysis screen. */
export function usePickPhoto() {
  const { settings } = useSettings();
  const { tap } = useHaptics();
  const [busy, setBusy] = useState(false);

  const pick = useCallback(
    async (from: 'camera' | 'library') => {
      tap();
      setBusy(true);
      try {
        const permission =
          from === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            from === 'camera' ? 'Camera access needed' : 'Photo access needed',
            from === 'camera'
              ? 'Allow camera access in Settings to photograph a leaf.'
              : 'Allow photo access in Settings to choose a leaf picture.',
            [
              { text: 'Not now', style: 'cancel' },
              ...(permission.canAskAgain ? [] : [{ text: 'Open Settings', onPress: () => Linking.openSettings() }]),
            ],
          );
          return;
        }

        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: settings.cropBeforeAnalyze,
          aspect: [1, 1],
          exif: false,
        };
        const result =
          from === 'camera'
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);
        const asset = result.canceled ? undefined : result.assets[0];
        if (asset) router.push({ pathname: '/analyze', params: { uri: asset.uri } });
      } catch (e) {
        Alert.alert('Could not open the photo', e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [settings.cropBeforeAnalyze, tap],
  );

  return { pick, busy };
}
