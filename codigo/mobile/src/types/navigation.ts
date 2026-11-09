import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Coordinates } from './domain';

export type MapSelection = { coordinates: Coordinates; selectedAt: number };

export type MainTabParamList = {
  Inicio: undefined;
  Mapa: { focusReportId?: string; focusAt?: number } | undefined;
  Relatar: { selectedLocation?: MapSelection } | undefined;
  Atividade: undefined;
  Perfil: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  StationDetail: { stationId: string };
  ReportDetail: { reportId: string };
  ReportEdit: { reportId: string; selectedLocation?: MapSelection };
  LocationPicker: { target: 'new' | 'edit'; reportId?: string; initialCoordinates?: Coordinates };
  ReportSuccess: { reportId: string; pending: boolean };
  Notifications: undefined;
  ProfileEdit: undefined;
  AccountSecurity: undefined;
  Moderation: undefined;
  Connection: undefined;
  OfficialData: undefined;
  ProfileSection: { section: 'location' | 'sources' | 'privacy' | 'help' };
};
