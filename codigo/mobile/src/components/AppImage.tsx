import { Image, type ImageProps } from 'react-native';
import { useAppStore } from '../store/useAppStore';

// Caminhos de fotos continuam válidos quando a URL temporária do túnel muda.
export function AppImage({ source, ...props }: ImageProps) {
  const baseUrl = useAppStore((s) => s.apiUrl);
  const resolved =
    typeof source === 'object' &&
    source !== null &&
    !Array.isArray(source) &&
    'uri' in source &&
    source.uri?.startsWith('/v1/media/')
      ? { ...source, uri: `${baseUrl}${source.uri}` }
      : source;
  return <Image source={resolved} {...props} />;
}
