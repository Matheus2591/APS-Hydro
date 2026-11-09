import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export async function selectPhoto(square = false): Promise<string | undefined> {
  // No navegador, abrir o seletor diretamente a partir do clique do usuário.
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Autorize o acesso às fotos ou continue sem imagem.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    ...(square ? { aspect: [1, 1] as [number, number] } : {}),
    quality: 0.5,
    base64: true,
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset?.base64) throw new Error('Não foi possível preparar a imagem. Escolha outra foto.');
  if (asset.base64.length > 2_666_664) throw new Error('Escolha uma foto menor (até 2 MB).');
  // O exportador nativo comprime os bytes base64 em JPEG, mesmo quando a origem era PNG.
  // Na web, o seletor preserva os bytes e o MIME do arquivo original.
  const mime = Platform.OS === 'web' ? (asset.mimeType ?? 'image/jpeg') : 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime))
    throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  return `data:${mime};base64,${asset.base64}`;
}
