'use client';

import { ReactNode } from 'react';
import { useBreakpoint, useDeviceDetection } from '@/utils/deviceDetection';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function ResponsiveContainer({ 
  children, 
  className = '',
  maxWidth = 'lg',
  padding = 'md'
}: ResponsiveContainerProps) {
  const _breakpoint = useBreakpoint();
  const deviceInfo = useDeviceDetection();

  // 最大幅のクラス設定
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    full: 'max-w-full'
  };

  // パディングのクラス設定
  const paddingClasses = {
    none: '',
    sm: 'px-4 py-2',
    md: 'px-4 sm:px-6 lg:px-8 py-4 sm:py-6',
    lg: 'px-6 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-12'
  };

  // デバイス固有のクラス
  const deviceClasses = deviceInfo?.type === 'mobile' 
    ? 'mobile-container' 
    : deviceInfo?.type === 'tablet' 
    ? 'tablet-container' 
    : 'desktop-container';

  return (
    <div 
      className={`
        w-full mx-auto
        ${maxWidthClasses[maxWidth]}
        ${paddingClasses[padding]}
        ${deviceClasses}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface GridContainerProps {
  children: ReactNode;
  columns?: {
    mobile?: number;  // 1024px未満（スマホ・10.2インチタブレット含む）
    tablet?: number;  // 1024px以上1280px未満
    desktop?: number; // 1280px以上
  };
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GridContainer({ 
  children, 
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  className = ''
}: GridContainerProps) {
  const breakpoint = useBreakpoint();

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  // 現在のデバイスに応じた列数を決定
  let currentColumns = columns.desktop || 3;
  if (breakpoint.isMobile) {
    currentColumns = columns.mobile || 1;
  } else if (breakpoint.isTablet) {
    currentColumns = columns.tablet || 2;
  }

  const gridClasses = `grid-cols-${currentColumns}`;

  return (
    <div 
      className={`
        grid
        ${gridClasses}
        ${gapClasses[gap]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface FlexContainerProps {
  children: ReactNode;
  direction?: 'row' | 'col';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FlexContainer({
  children,
  direction = 'col',
  justify = 'start',
  align = 'start',
  wrap = false,
  gap = 'md',
  className = ''
}: FlexContainerProps) {
  const directionClass = `flex-${direction}`;
  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  };
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  };
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  };

  return (
    <div 
      className={`
        flex
        ${directionClass}
        ${justifyClasses[justify]}
        ${alignClasses[align]}
        ${wrap ? 'flex-wrap' : ''}
        ${gapClasses[gap]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}