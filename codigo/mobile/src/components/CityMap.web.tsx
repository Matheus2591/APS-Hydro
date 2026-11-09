import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createMapDocument } from '../map/document';
import { useMapData } from '../map/useMapData';
import type { CityMapProps } from '../map/types';

export function CityMap(props: CityMapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const document = useMemo(createMapDocument, []);
  const { payload, json, handleMessage } = useMapData(props);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = handleMessage(event.data);
      if (message?.type === 'ready') setReady(true);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  });
  useEffect(() => {
    if (ready)
      frame.current?.contentWindow?.postMessage(
        { channel: 'hydropulse-map', type: 'update', payload },
        window.location.origin,
      );
  }, [ready, json]);
  return (
    <View style={styles.map}>
      {createElement('iframe', {
        ref: frame,
        title: 'Mapa geográfico OpenStreetMap de Santos',
        srcDoc: document,
        onLoad: () => setReady(true),
        sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
        style: { border: 0, width: '100%', height: '100%', position: 'absolute', inset: 0 },
      })}
    </View>
  );
}
const styles = StyleSheet.create({ map: { flex: 1, minHeight: 200, backgroundColor: '#E7ECEF' } });
