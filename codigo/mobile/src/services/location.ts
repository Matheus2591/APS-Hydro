import * as Location from 'expo-location';
import type { Coordinates } from '../types/domain';

export async function getDeviceLocation(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error('Localização não autorizada. Você pode escolher o ponto no mapa.');
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error(
      'A localização do aparelho está desativada. Você pode escolher o ponto no mapa.',
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'A localização demorou mais de 20 segundos. Escolha o ponto no mapa ou tente novamente.',
              ),
            ),
          20_000,
        );
      }),
    ]);
    return { latitude: result.coords.latitude, longitude: result.coords.longitude };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
