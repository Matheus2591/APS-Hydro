import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { createMapDocument } from '../map/document';
import { useMapData } from '../map/useMapData';
import type { CityMapProps } from '../map/types';

export function CityMap(props: CityMapProps) {
  const browser = useRef<WebView>(null);
  const source = useMemo(() => ({ html: createMapDocument() }), []);
  const { json, handleMessage } = useMapData(props);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (ready) browser.current?.injectJavaScript(`window.HydroPulseMap.update(${json});true;`);
  }, [json, ready]);
  const openLink = (url: string) => {
    if (
      url.startsWith('https://www.openstreetmap.org/') ||
      url.startsWith('https://leafletjs.com/')
    )
      void Linking.openURL(url).catch(() => undefined);
  };
  return (
    <View style={styles.map}>
      <WebView
        ref={browser}
        source={source}
        originWhitelist={['*']}
        style={styles.map}
        applicationNameForUserAgent="HydroPulseAPS/3.0.4 (br.com.hydropulse.app)"
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        mixedContentMode="never"
        geolocationEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        onMessage={(event) => {
          const message = handleMessage(event.nativeEvent.data);
          if (message?.type === 'ready') setReady(true);
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith('about:blank')) return true;
          openLink(request.url);
          return false;
        }}
        onOpenWindow={(event) => openLink(event.nativeEvent.targetUrl)}
        onError={() => setFailed(true)}
        onRenderProcessGone={() => setFailed(true)}
      />
      {failed && (
        <View style={styles.error}>
          <Text>Não foi possível abrir o mapa. Seus relatos continuam salvos.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFailed(false);
              setReady(false);
              browser.current?.reload();
            }}
            style={{ padding: 16 }}
          >
            <Text>Tentar novamente</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 200, backgroundColor: '#E7ECEF' },
  error: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
