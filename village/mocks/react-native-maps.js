import { View } from 'react-native';

export default function MapView({ children, style }) {
  return <View style={[{ backgroundColor: '#d0d8e8', alignItems: 'center', justifyContent: 'center' }, style]}>
    {children}
  </View>;
}

export function Marker() { return null; }
export function Circle() { return null; }
export function Polyline() { return null; }
export function Polygon() { return null; }
export function Callout() { return null; }
