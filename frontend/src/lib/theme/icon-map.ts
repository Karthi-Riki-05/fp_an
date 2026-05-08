/**
 * Legacy icon-name → AntD icon component map.
 *
 * Legacy app uses Font Awesome 4 (`fa-*`), Ionicons 2 (`ion-*`), and a few
 * Glyphicons (`glyphicon-*`). We translate the 30-50 most-used ones to
 * @ant-design/icons here so any port can resolve a legacy icon name to the
 * right AntD component without each page making its own decision.
 *
 * The map is intentionally INCOMPLETE — additions go in as Phase 4b touches
 * each screen. Unknown icons fall back to ApiOutlined with a console warn
 * (see resolveIcon() below).
 */

import {
  AppstoreOutlined,
  AreaChartOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  ClusterOutlined,
  CommentOutlined,
  ContactsOutlined,
  ControlOutlined,
  CopyOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DragOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FormOutlined,
  GlobalOutlined,
  HomeOutlined,
  ImportOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  LockOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  MinusCircleOutlined,
  MonitorOutlined,
  NodeIndexOutlined,
  NotificationOutlined,
  OrderedListOutlined,
  PauseCircleOutlined,
  PieChartOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  PoweroffOutlined,
  PrinterOutlined,
  ProfileOutlined,
  ProjectOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  SyncOutlined,
  TableOutlined,
  TagOutlined,
  TeamOutlined,
  ToolOutlined,
  TrademarkCircleOutlined,
  UnlockOutlined,
  UploadOutlined,
  UserAddOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ style?: React.CSSProperties; className?: string }>;

/**
 * Mapping ordered by domain, not alphabetically — easier to scan when porting.
 * Names use the bare legacy class without the prefix (`fa-tachometer` → `tachometer`).
 */
export const ICON_MAP: Record<string, IconComponent> = {
  // ---- navigation / dashboard ----
  'tachometer':         DashboardOutlined,
  'dashboard':          DashboardOutlined,
  'home':               HomeOutlined,
  'sitemap':            ClusterOutlined,
  'th-large':           AppstoreOutlined,
  'th-list':            OrderedListOutlined,
  'list':               OrderedListOutlined,
  'table':              TableOutlined,

  // ---- generic CRUD ----
  'plus':               PlusOutlined,
  'plus-circle':        PlusOutlined,
  'edit':               EditOutlined,
  'pencil':             EditOutlined,
  'trash':              DeleteOutlined,
  'trash-o':            DeleteOutlined,
  'eye':                EyeOutlined,
  'copy':               CopyOutlined,
  'save':               CheckOutlined,
  'check':              CheckOutlined,
  'check-circle':       CheckCircleOutlined,
  'times':              CloseCircleOutlined,
  'times-circle':       CloseCircleOutlined,
  'minus-circle':       MinusCircleOutlined,
  'refresh':            SyncOutlined,
  'reload':             ReloadOutlined,

  // ---- forms / inputs ----
  'search':             SearchOutlined,
  'filter':             FilterOutlined,
  'sort':               SwapOutlined,

  // ---- data domain (FP Analyzer specific) ----
  'cogs':               SettingOutlined,
  'cog':                SettingOutlined,
  'wrench':             ToolOutlined,
  'cubes':              AppstoreOutlined,
  'cube':               AppstoreOutlined,
  'industry':           BankOutlined,
  'building':           BankOutlined,
  'connectdevelop':     NodeIndexOutlined,    // for flow designs
  'flowchart':          NodeIndexOutlined,
  'project-diagram':    ProjectOutlined,
  'tag':                TagOutlined,
  'tags':               TagOutlined,
  'shopping-cart':      ShoppingCartOutlined,
  'list-alt':           ProfileOutlined,
  'list-ol':            OrderedListOutlined,

  // ---- shifts / time ----
  'clock-o':            ClockCircleOutlined,
  'clock':              ClockCircleOutlined,
  'ion-android-stopwatch': ClockCircleOutlined,
  'calendar':           CalendarOutlined,
  'calendar-alt':       CalendarOutlined,

  // ---- charts / analytics ----
  'bar-chart':          BarChartOutlined,
  'bar-chart-o':        BarChartOutlined,
  'line-chart':         LineChartOutlined,
  'pie-chart':          PieChartOutlined,
  'area-chart':         AreaChartOutlined,
  'show-chart':         AreaChartOutlined,

  // ---- machine status ----
  'play':               PlayCircleOutlined,
  'play-circle':        PlayCircleOutlined,
  'pause':              PauseCircleOutlined,
  'stop':               PauseCircleOutlined,
  'power-off':          PoweroffOutlined,
  'exclamation-triangle': WarningOutlined,
  'warning':            WarningOutlined,
  'info-circle':        InfoCircleOutlined,
  'question-circle':    QuestionCircleOutlined,
  'bell':               BellOutlined,
  'bell-o':             BellOutlined,
  'broadcast-tower':    NotificationOutlined,
  'wifi':               GlobalOutlined,

  // ---- files / folders / docs ----
  'folder':             FolderOutlined,
  'folder-o':           FolderOutlined,
  'folder-open':        FolderOpenOutlined,
  'folder-open-o':      FolderOpenOutlined,
  'file':               FileOutlined,
  'file-o':             FileOutlined,
  'file-text':          FormOutlined,
  'file-excel-o':       FileExcelOutlined,
  'upload':             UploadOutlined,
  'cloud-upload':       CloudUploadOutlined,
  'download':           DownloadOutlined,
  'import':             ImportOutlined,
  'export':             ExportOutlined,

  // ---- users / access ----
  'user':               UserOutlined,
  'user-o':             UserOutlined,
  'user-plus':          UserAddOutlined,
  'users':              TeamOutlined,
  'group':              TeamOutlined,
  'address-book':       ContactsOutlined,
  'lock':               LockOutlined,
  'unlock':             UnlockOutlined,
  'shield':             SafetyCertificateOutlined,
  'sign-out':           LogoutOutlined,
  'sign-in':            LogoutOutlined,

  // ---- comms ----
  'envelope':           MailOutlined,
  'envelope-o':         MailOutlined,
  'mail':               MailOutlined,
  'comment':            CommentOutlined,
  'comments':           CommentOutlined,

  // ---- misc ----
  'bars':               MenuOutlined,
  'navicon':            MenuOutlined,
  'gear':               SettingOutlined,
  'sliders':            ControlOutlined,
  'globe':              GlobalOutlined,
  'language':           GlobalOutlined,
  'database':           DatabaseOutlined,
  'book':               BookOutlined,
  'print':              PrinterOutlined,
  'arrows':             DragOutlined,
  'star':               TrademarkCircleOutlined,
  'desktop':            MonitorOutlined,
  'monitor':            MonitorOutlined,
  'exclamation-circle': ExclamationCircleOutlined,
};

/**
 * Resolve a legacy icon name (with or without prefix) to an AntD component.
 * Falls back to a question mark for unmapped names so we notice during port.
 */
export function resolveIcon(legacyName: string): IconComponent {
  const stripped = legacyName.replace(/^fa-|^ion-|^glyphicon-/, '');
  const Icon = ICON_MAP[stripped] ?? ICON_MAP[legacyName];
  if (Icon) return Icon;
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[icon-map] unmapped legacy icon: ${legacyName}`);
  }
  return QuestionCircleOutlined;
}
