// Wave v5 icon set.
//
// The v5 design ships its own hand-drawn stroke icons rather than a library set,
// so these are transcribed path-for-path from the design source. Default stroke
// weights match the design (1.6 for nav/inline, 1.7 for accent, 2+ for chevrons).
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../theme/tokens";

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type Icon = (props: IconProps) => JSX.Element;

function box({ size = 18 }: IconProps) {
  return { width: size, height: size, viewBox: "0 0 24 24" };
}

export const BellIcon: Icon = ({ size = 16, color = colors.ink, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path
      d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
);

export const CartIcon: Icon = ({ size = 16, color = colors.primary, strokeWidth = 1.7 }) => (
  <Svg {...box({ size })} fill="none">
    <Circle cx={9} cy={20} r={1.6} stroke={color} strokeWidth={strokeWidth} />
    <Circle cx={18} cy={20} r={1.6} stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M2 3h3l2.4 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21.5 7H6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PinIcon: Icon = ({ size = 16, color = colors.primary, strokeWidth = 1.7 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const PinDotIcon: Icon = ({ size = 19, color = colors.primary, strokeWidth = 1.7 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx={12} cy={9} r={2.4} stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const BoxIcon: Icon = ({ size = 19, color = colors.primary, strokeWidth = 1.7 }) => (
  <Svg {...box({ size })} fill="none">
    <Path
      d="M3.5 8L12 3.5 20.5 8M3.5 8v9L12 21.5 20.5 17V8"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const HistoryIcon: Icon = ({ size = 19, color = colors.primary, strokeWidth = 1.7 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M4 7h16v11H4z" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M4 11h16" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const CardIcon: Icon = ({ size = 19, color = colors.primary, strokeWidth = 1.7 }) => (
  <Svg {...box({ size })} fill="none">
    <Rect x={3} y={5} width={18} height={14} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M3 10h18" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const HomeIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path
      d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5a.5.5 0 0 1-.5-.5V15a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4.5a.5.5 0 0 1-.5.5H5a1 1 0 0 1-1-1V10.5Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
);

export const UserIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const ChevronLeftIcon: Icon = ({ size = 14, color = colors.ink, strokeWidth = 2 }) => (
  <Svg width={size * (8 / 14)} height={size} viewBox="0 0 12 20" fill="none">
    <Path d="M10 2L2 10l8 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronRightIcon: Icon = ({ size = 13, color = colors.primary, strokeWidth = 2.2 }) => (
  <Svg width={size * (7 / 13)} height={size} viewBox="0 0 12 20" fill="none">
    <Path d="M2 2l8 8-8 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CheckIcon: Icon = ({ size = 13, color = colors.primary, strokeWidth = 2.5 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M5 12.5l5 5L19 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SearchIcon: Icon = ({ size = 16, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M21 21l-4.3-4.3" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const MessageIcon: Icon = ({ size = 17, color = colors.ink, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M4 5h16v11H8l-4 4V5Z" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const PhoneIcon: Icon = ({ size = 17, color = colors.white, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path
      d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2C10.5 19 5 13.5 5 6a2 2 0 0 1 1-3Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
);

export const TruckIcon: Icon = ({ size = 42, color = colors.primary, strokeWidth = 1.9 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M3 8h11v9H3z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M14 11h4l3 3v3h-7v-6Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Circle cx={7} cy={19} r={1.7} fill={color} />
    <Circle cx={17} cy={19} r={1.7} fill={color} />
  </Svg>
);

export const MobileIcon: Icon = ({ size = 18, color = colors.ink, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Rect x={6} y={2} width={12} height={20} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M10 19h4" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const CashIcon: Icon = ({ size = 18, color = colors.ink, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M12 8v8M9.5 10a2.5 2 0 0 1 2.5-1.5c1.4 0 2.5.7 2.5 1.7s-1 1.5-2.5 1.8c-1.5.3-2.5.8-2.5 1.8S10.6 16 12 16a2.5 2 0 0 0 2.5-1.5"
      stroke={color}
      strokeWidth={1.5}
    />
  </Svg>
);

export const PlusIcon: Icon = ({ size = 16, color = colors.primary, strokeWidth = 2 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M12 4v16M4 12h16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const MinusIcon: Icon = ({ size = 16, color = colors.ink, strokeWidth = 2 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M4 12h16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const CalendarIcon: Icon = ({ size = 18, color = colors.ink, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path
      d="M4.5 6.5a1.5 1.5 0 011.5-1.5h12a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H6a1.5 1.5 0 01-1.5-1.5v-12z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Path d="M4.5 9.5h15M8.5 3.5v3M15.5 3.5v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const AlertIcon: Icon = ({ size = 38, color = colors.danger, strokeWidth = 1.7 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M12 8v5" stroke={color} strokeWidth={strokeWidth + 0.5} strokeLinecap="round" />
    <Circle cx={12} cy={16.5} r={1.2} fill={color} />
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const LogoutIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path
      d="M15 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9M18 8l4 4-4 4M22 12H10"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ElectronicsIcon: Icon = ({ size = 22, color = colors.ink, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Rect x={4} y={3} width={16} height={18} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M9 7h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const PharmacyIcon: Icon = ({ size = 22, color = colors.ink, strokeWidth = 1.5 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M9 3h6l1 4H8l1-4Z" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M8 7h8v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7Z" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const CloseIcon: Icon = ({ size = 16, color = colors.muted, strokeWidth = 2 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const CameraIcon: Icon = ({ size = 18, color = colors.ink, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M3 8.5h3.5L8 6h8l1.5 2.5H21V19H3V8.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Circle cx={12} cy={13} r={3.5} stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

// --- Rider / shop-owner glyphs, drawn to the same v5 stroke spec ---

export const BoltIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M13 2L4 13h6l-1 9 9-11h-6l1-9Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
  </Svg>
);

export const WalletIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Rect x={3} y={6} width={18} height={13} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
    <Path d="M3 10h18" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx={17} cy={14.5} r={1.2} fill={color} />
  </Svg>
);

export const DashboardIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Rect x={3.5} y={3.5} width={7} height={7} rx={2} stroke={color} strokeWidth={strokeWidth} />
    <Rect x={13.5} y={3.5} width={7} height={7} rx={2} stroke={color} strokeWidth={strokeWidth} />
    <Rect x={3.5} y={13.5} width={7} height={7} rx={2} stroke={color} strokeWidth={strokeWidth} />
    <Rect x={13.5} y={13.5} width={7} height={7} rx={2} stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

export const MenuIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Path d="M7 3v8a2 2 0 1 1-4 0V3M5 11v10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M17 3c-1.7 1.4-2.5 3.4-2.5 5.5S15.3 12 17 13v8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const SettingsIcon: Icon = ({ size = 18, color = colors.muted, strokeWidth = 1.6 }) => (
  <Svg {...box({ size })} fill="none">
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);
