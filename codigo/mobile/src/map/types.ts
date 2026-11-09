import type { Coordinates, FloodReport, Station } from '../types/domain';
import type { MapFocus } from './geo';

export type CityMapProps = {
  stations?: Station[];
  reports?: FloodReport[];
  onStationPress?: (station: Station) => void;
  onReportPress?: (report: FloodReport) => void;
  selectable?: boolean;
  selection?: Coordinates | null;
  onCoordinateSelect?: (coordinates: Coordinates) => void;
  userLocation?: Coordinates | null;
  focus?: MapFocus;
};
