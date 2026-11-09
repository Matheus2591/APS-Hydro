import type { CityMapProps } from './types';
import { hasConfirmedLocation, makeMapPoints, readMapMessage, serializeMapData } from './geo';

export function useMapData(props: CityMapProps) {
  const reports = props.reports ?? [];
  const stations = props.stations ?? [];
  const payload = {
    points: makeMapPoints(reports, stations),
    selectable: !!props.selectable,
    selection: props.selection,
    userLocation: props.userLocation,
    focus: props.focus,
  };
  const handleMessage = (raw: unknown) => {
    const message = readMapMessage(raw);
    if (message?.type === 'select' && props.selectable)
      props.onCoordinateSelect?.(message.coordinates);
    if (message?.type === 'point') {
      if (message.kind === 'report') {
        const report = reports.find((item) => item.id === message.id && hasConfirmedLocation(item));
        if (report) props.onReportPress?.(report);
      } else {
        const station = stations.find((item) => item.id === message.id);
        if (station) props.onStationPress?.(station);
      }
    }
    return message;
  };
  return { payload, json: serializeMapData(payload), handleMessage };
}
