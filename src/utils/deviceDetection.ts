'use client';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceInfo {
  type: DeviceType;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

/**
 * User-Agent文字列からデバイスタイプを判定
 */
export function detectDeviceFromUserAgent(userAgent: string): DeviceType {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const tabletRegex = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)|Android(?=.*\bTablet\b)/i;
  
  if (tabletRegex.test(userAgent)) {
    return 'tablet';
  }
  
  if (mobileRegex.test(userAgent)) {
    return 'mobile';
  }
  
  return 'desktop';
}

/**
 * 画面サイズからデバイスタイプを判定
 */
export function detectDeviceFromScreenSize(width: number): DeviceType {
  if (width < 768) {
    return 'mobile';
  } else if (width < 1024) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * タッチデバイスかどうかを判定
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error Legacy property for older browsers
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * 現在のデバイス情報を取得
 */
export function getCurrentDeviceInfo(): DeviceInfo | null {
  if (typeof window === 'undefined') return null;
  
  const userAgent = navigator.userAgent;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // User-Agentと画面サイズ両方で判定し、より確実な方を採用
  const _typeFromUA = detectDeviceFromUserAgent(userAgent);
  const typeFromScreen = detectDeviceFromScreenSize(screenWidth);
  
  // 画面サイズによる判定を優先（より正確）
  const type = typeFromScreen;
  
  return {
    type,
    isTouchDevice: isTouchDevice(),
    screenWidth,
    screenHeight,
    userAgent,
  };
}

/**
 * React Hook: デバイス情報を監視
 */
import { useState, useEffect } from 'react';

export function useDeviceDetection(): DeviceInfo | null {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  
  useEffect(() => {
    const updateDeviceInfo = () => {
      setDeviceInfo(getCurrentDeviceInfo());
    };
    
    // 初期化
    updateDeviceInfo();
    
    // ウィンドウリサイズ時に更新
    window.addEventListener('resize', updateDeviceInfo);
    
    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
    };
  }, []);
  
  return deviceInfo;
}

/**
 * React Hook: 画面サイズ監視
 */
export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({
    width: 0,
    height: 0,
  });
  
  useEffect(() => {
    const updateScreenSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);
  
  return screenSize;
}

/**
 * React Hook: レスポンシブブレークポイント判定
 */
export function useBreakpoint() {
  const { width } = useScreenSize();
  
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isSmall: width < 640,
    isMedium: width >= 640 && width < 1024,
    isLarge: width >= 1024,
  };
}