// Ambient declarations for libraries without first-party types we use yet.
// Loosen them as you start using the modules in earnest.

declare module 'jwt-encode' {
  export default function sign(payload: unknown, secret: string): string;
}

declare module 'react-native-vector-icons/MaterialIcons' {
  import { ComponentType } from 'react';
  import { TextProps } from 'react-native';
  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }
  const Icon: ComponentType<IconProps>;
  export default Icon;
}
