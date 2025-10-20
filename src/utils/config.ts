/**
 * セキュリティ強化された環境変数の管理とバリデーション
 */

import crypto from 'crypto';

interface AppConfig {
  miro: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
  };
  app: {
    url: string;
    nextAuthUrl: string;
    nextAuthSecret: string;
    encryptionKey: string;
  };
  upload: {
    maxFileSize: number;
    allowedFileTypes: string[];
    tempDirectory: string;
    cleanupInterval: number;
  };
  security: {
    tokenExpirationCheck: boolean;
    runtimeValidation: boolean;
    secretRotationInterval: number;
  };
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * 機密情報の検出パターン
 */
const SENSITIVE_PATTERNS = {
  accessToken: /^[a-zA-Z0-9_-]{40,}$/,
  clientSecret: /^[a-fA-F0-9]{32,64}$/,
  apiKey: /^[a-zA-Z0-9_-]{20,}$/,
};

/**
 * 環境変数のセキュリティチェック
 */
function validateEnvironmentSecurity(): { isSecure: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // 本番環境での環境変数チェック
  if (process.env.NODE_ENV === 'production') {
    // 必要な暗号化キーの存在確認
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
      warnings.push('本番環境では32文字以上の暗号化キーが必要です');
    }

    // HTTPSの確認
    if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
      warnings.push('本番環境ではHTTPSを使用してください');
    }

    // デフォルト値の使用確認
    if (process.env.NEXTAUTH_SECRET === 'your-secret-here') {
      warnings.push('本番環境ではデフォルトのシークレットを変更してください');
    }
  }

  // 環境変数の露出チェック
  const publicEnvVars = Object.keys(process.env).filter(key => 
    key.startsWith('NEXT_PUBLIC_')
  );
  
  for (const envVar of publicEnvVars) {
    const value = process.env[envVar];
    if (value && (
      SENSITIVE_PATTERNS.accessToken.test(value) ||
      SENSITIVE_PATTERNS.clientSecret.test(value) ||
      SENSITIVE_PATTERNS.apiKey.test(value)
    )) {
      warnings.push(`公開環境変数 ${envVar} に機密情報が含まれている可能性があります`);
    }
  }

  return {
    isSecure: warnings.length === 0,
    warnings,
  };
}

/**
 * 機密情報の暗号化
 */
function encryptSecret(text: string, key: string): string {
  if (!key || key.length < 32) {
    throw new Error('暗号化キーは32文字以上である必要があります');
  }

  // AES-256-GCM を安全に利用（IV + authTag を付与）
  const iv = crypto.randomBytes(12); // GCMでは12バイト推奨
  const derivedKey = crypto.createHash('sha256').update(key).digest(); // 32 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // iv:ciphertext:tag（hex）形式で返す
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * 機密情報の復号化
 */
function decryptSecret(encryptedText: string, key: string): string {
  if (!key || key.length < 32) {
    throw new Error('復号化キーは32文字以上である必要があります');
  }

  const parts = encryptedText.split(':');

  // 期待形式: iv:ciphertext:tag
  if (parts.length === 3) {
    const [ivHex, encHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(encHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const derivedKey = crypto.createHash('sha256').update(key).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  // レガシー形式（iv:ciphertext 等）には対応しない
  throw new Error('無効な暗号化形式です');
}

/**
 * 環境変数の安全な取得（将来使用予定）
 */
function _getSecureEnvVar(key: string, isRequired: boolean = true): string {
  const value = process.env[key];
  
  if (isRequired && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  
  if (!value) return '';
  
  // 暗号化された値の検出と復号化
  if (value.includes(':') && process.env.ENCRYPTION_KEY) {
    try {
      return decryptSecret(value, process.env.ENCRYPTION_KEY);
    } catch (_error) {
      console.warn(`Failed to decrypt ${key}, using raw value`);
      return value;
    }
  }
  
  return value;
}

/**
 * 環境変数から設定を読み込み
 */
function loadConfig(): AppConfig {
  const isServer = typeof window === 'undefined';

  // セキュリティチェックの実行
  const securityCheck = validateEnvironmentSecurity();
  if (!securityCheck.isSecure) {
    console.warn('環境変数セキュリティ警告:', securityCheck.warnings);
    
    // 本番環境でのみ致命的エラーとして扱う（ビルド時は除く）
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
      throw new Error(`セキュリティ要件を満たしていません: ${securityCheck.warnings.join(', ')}`);
    }
  }

  if (isServer) {
    const requiredEnvVars = [
      'MIRO_CLIENT_ID',
      'MIRO_CLIENT_SECRET', 
      'MIRO_ACCESS_TOKEN',
      'NEXT_PUBLIC_APP_URL',
      'NEXTAUTH_SECRET',
    ];

    // 必須環境変数の存在確認
    for (const key of requiredEnvVars) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }
  } else {
    // クライアントサイドでの必須環境変数の確認
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error(`Missing required environment variable: NEXT_PUBLIC_APP_URL`);
    }
  }

  return {
    miro: {
      clientId: process.env.MIRO_CLIENT_ID ?? '',
      clientSecret: process.env.MIRO_CLIENT_SECRET ?? '',
      accessToken: process.env.MIRO_ACCESS_TOKEN ?? '',
      refreshToken: process.env.MIRO_REFRESH_TOKEN ?? '',
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL!,
      nextAuthUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL!,
      nextAuthSecret: process.env.NEXTAUTH_SECRET ?? '',
      encryptionKey: isServer ? (process.env.ENCRYPTION_KEY || generateEncryptionKey()) : '',
    },
    upload: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
      allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
        'image/jpeg',
        'image/png', 
        'image/gif'
      ],
      tempDirectory: process.env.TEMP_DIRECTORY || '/tmp',
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600000', 10), // 1時間
    },
    security: {
      tokenExpirationCheck: process.env.TOKEN_EXPIRATION_CHECK === 'true',
      runtimeValidation: process.env.RUNTIME_VALIDATION !== 'false',
      secretRotationInterval: parseInt(process.env.SECRET_ROTATION_INTERVAL || '2592000000', 10), // 30日
    },
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  };
}

/**
 * 暗号化キーの生成（開発環境用）
 */
function generateEncryptionKey(): string {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('本番環境では暗号化キーを明示的に設定してください');
  }
  
  const key = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  開発用の暗号化キーを生成しました。本番環境では ENCRYPTION_KEY 環境変数を設定してください。');
  return key;
}

/**
 * アプリケーション設定
 */
export const config = loadConfig();

/**
 * アクセストークンの有効性チェック
 */
async function validateMiroToken(token: string): Promise<boolean> {
  if (!token || token.length < 20) {
    return false;
  }

  try {
    // Miro APIへの軽量なリクエストでトークンを検証
    const response = await fetch('https://api.miro.com/v2/boards?limit=1', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return response.status !== 401;
  } catch (error) {
    console.warn('Token validation failed:', error);
    return false;
  }
}

/**
 * 設定の検証
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const isServer = typeof window === 'undefined';

  // Miro設定の検証
  if (!config.miro.clientId || config.miro.clientId.length < 10) {
    errors.push('Invalid Miro Client ID format');
  }

  // アクセストークンの基本形式チェック
  if (!config.miro.accessToken || config.miro.accessToken.length < 20) {
    errors.push('Invalid Miro Access Token format');
  }

  // クライアントシークレットの検証
  if (!config.miro.clientSecret || config.miro.clientSecret.length < 20) {
    errors.push('Invalid Miro Client Secret format');
  }

  // ファイルサイズの検証
  if (config.upload.maxFileSize <= 0 || config.upload.maxFileSize > 50 * 1024 * 1024) {
    errors.push('Max file size should be between 1 byte and 50MB');
  }

  // ファイルタイプの検証
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const invalidTypes = config.upload.allowedFileTypes.filter(
    type => !validMimeTypes.includes(type)
  );
  if (invalidTypes.length > 0) {
    errors.push(`Invalid file types: ${invalidTypes.join(', ')}`);
  }

  // セキュリティ設定の検証（サーバーサイドでのみ実行）
  if (isServer && config.isProduction && config.app.encryptionKey.length < 32) {
    errors.push('Production environment requires encryption key of at least 32 characters');
  }

  // HTTPS検証（本番環境）
  if (config.isProduction && !config.app.url.startsWith('https://')) {
    errors.push('Production environment requires HTTPS');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 非同期設定検証（トークン有効性を含む）
 */
export async function validateConfigAsync(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  const basicValidation = validateConfig();
  const warnings: string[] = [];
  
  // 基本検証が失敗した場合は早期リターン
  if (!basicValidation.isValid) {
    return {
      isValid: false,
      errors: basicValidation.errors,
      warnings,
    };
  }

  // アクセストークンの有効性チェック（オプション）
  if (config.security.tokenExpirationCheck) {
    try {
      const isTokenValid = await validateMiroToken(config.miro.accessToken);
      if (!isTokenValid) {
        basicValidation.errors.push('Miro access token is invalid or expired');
      }
    } catch (_error) {
      warnings.push('Could not validate Miro token due to network error');
    }
  }

  return {
    isValid: basicValidation.errors.length === 0,
    errors: basicValidation.errors,
    warnings,
  };
}

/**
 * セキュリティ設定のランタイムチェック
 */
export function performSecurityRuntimeCheck(): void {
  if (!config.security.runtimeValidation) {
    return;
  }

  // 環境変数の漏洩チェック
  const sensitiveVars = ['MIRO_CLIENT_SECRET', 'MIRO_ACCESS_TOKEN', 'NEXTAUTH_SECRET'];
  
  if (typeof window !== 'undefined') {
    // クライアントサイドでの漏洩チェック
    for (const varName of sensitiveVars) {
      if ((window as unknown as Record<string, unknown>)[varName] || (window as unknown as { process?: { env?: Record<string, unknown> } }).process?.env?.[varName]) {
        console.error(`SECURITY WARNING: ${varName} is exposed on client side!`);
      }
    }
  }

  // メモリ使用量のチェック（Node.js環境）
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memUsageMB > 500) { // 500MB超過で警告
      console.warn(`High memory usage detected: ${memUsageMB}MB`);
    }
  }
}

/**
 * セキュリティ設定のレポート生成
 */
export function generateSecurityReport(): {
  timestamp: Date;
  environment: string;
  securityLevel: 'low' | 'medium' | 'high';
  checks: Array<{ name: string; status: 'pass' | 'fail' | 'warning'; details?: string }>;
} {
  const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warning'; details?: string }> = [];
  
  // HTTPS チェック
  checks.push({
    name: 'HTTPS Enforcement',
    status: config.app.url.startsWith('https://') || config.isDevelopment ? 'pass' : 'fail',
    details: config.app.url.startsWith('https://') ? undefined : 'Application is not using HTTPS',
  });

  // 暗号化キー チェック
  checks.push({
    name: 'Encryption Key',
    status: config.app.encryptionKey.length >= 32 ? 'pass' : 'fail',
    details: config.app.encryptionKey.length >= 32 ? undefined : 'Encryption key is too short',
  });

  // 環境変数セキュリティ チェック
  const envSecurity = validateEnvironmentSecurity();
  checks.push({
    name: 'Environment Security',
    status: envSecurity.isSecure ? 'pass' : 'warning',
    details: envSecurity.isSecure ? undefined : envSecurity.warnings.join(', '),
  });

  // ファイルアップロード制限 チェック
  checks.push({
    name: 'File Upload Limits',
    status: config.upload.maxFileSize <= 10 * 1024 * 1024 ? 'pass' : 'warning',
    details: config.upload.maxFileSize > 10 * 1024 * 1024 ? 'File size limit exceeds 10MB' : undefined,
  });

  // セキュリティレベルの決定
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  
  let securityLevel: 'low' | 'medium' | 'high';
  if (failCount > 0) {
    securityLevel = 'low';
  } else if (warningCount > 1) {
    securityLevel = 'medium';
  } else {
    securityLevel = 'high';
  }

  return {
    timestamp: new Date(),
    environment: config.isDevelopment ? 'development' : 'production',
    securityLevel,
    checks,
  };
}

/**
 * 開発環境でのデバッグ情報表示
 */
export function debugConfig(): void {
  if (config.isDevelopment) {
    console.log('App Configuration:', {
      miro: {
        clientId: config.miro.clientId.substring(0, 10) + '...',
        hasAccessToken: !!config.miro.accessToken,
        hasRefreshToken: !!config.miro.refreshToken,
        tokenLength: config.miro.accessToken.length,
      },
      app: {
        url: config.app.url,
        environment: process.env.NODE_ENV,
        hasEncryptionKey: !!config.app.encryptionKey,
        encryptionKeyLength: config.app.encryptionKey.length,
      },
      upload: {
        maxFileSize: `${Math.round(config.upload.maxFileSize / 1024 / 1024)}MB`,
        allowedTypes: config.upload.allowedFileTypes,
        tempDirectory: config.upload.tempDirectory,
        cleanupInterval: `${config.upload.cleanupInterval / 1000}s`,
      },
      security: {
        tokenExpirationCheck: config.security.tokenExpirationCheck,
        runtimeValidation: config.security.runtimeValidation,
        secretRotationInterval: `${config.security.secretRotationInterval / (24 * 60 * 60 * 1000)}日`,
      },
    });

    // 設定検証の実行
    const validation = validateConfig();
    if (!validation.isValid) {
      console.warn('Configuration validation errors:', validation.errors);
    }

    // セキュリティレポートの表示
    const securityReport = generateSecurityReport();
    console.log('Security Report:', {
      level: securityReport.securityLevel,
      issues: securityReport.checks.filter(c => c.status !== 'pass'),
    });

    // セキュリティランタイムチェックの実行
    performSecurityRuntimeCheck();
  }
}

/**
 * 機密情報用のヘルパー関数
 */
export const SecretUtils = {
  /**
   * 機密情報の暗号化（エクスポート用）
   */
  encrypt: (text: string, key?: string): string => {
    const encryptionKey = key || config.app.encryptionKey;
    return encryptSecret(text, encryptionKey);
  },

  /**
   * 機密情報の復号化（エクスポート用）
   */
  decrypt: (encryptedText: string, key?: string): string => {
    const encryptionKey = key || config.app.encryptionKey;
    return decryptSecret(encryptedText, encryptionKey);
  },

  /**
   * 機密情報のマスキング
   */
  mask: (secret: string, visibleChars: number = 4): string => {
    if (!secret || secret.length <= visibleChars) {
      return '*'.repeat(8);
    }
    
    const start = secret.substring(0, visibleChars);
    const masked = '*'.repeat(Math.max(8, secret.length - visibleChars));
    return start + masked;
  },

  /**
   * セキュアなランダム文字列生成
   */
  generateSecureRandom: (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * パスワード強度チェック
   */
  checkPasswordStrength: (password: string): {
    strength: 'weak' | 'medium' | 'strong';
    score: number;
    suggestions: string[];
  } => {
    let score = 0;
    const suggestions: string[] = [];

    // 長さチェック
    if (password.length >= 8) score += 1;
    else suggestions.push('8文字以上にしてください');

    if (password.length >= 12) score += 1;
    else if (password.length >= 8) suggestions.push('12文字以上にするとより安全です');

    // 文字種チェック
    if (/[a-z]/.test(password)) score += 1;
    else suggestions.push('小文字を含めてください');

    if (/[A-Z]/.test(password)) score += 1;
    else suggestions.push('大文字を含めてください');

    if (/[0-9]/.test(password)) score += 1;
    else suggestions.push('数字を含めてください');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else suggestions.push('記号を含めてください');

    // 強度判定
    let strength: 'weak' | 'medium' | 'strong';
    if (score <= 2) strength = 'weak';
    else if (score <= 4) strength = 'medium';
    else strength = 'strong';

    return { strength, score, suggestions };
  },
};

/**
 * 環境変数テンプレートの生成
 */
export function generateEnvTemplate(): string {
  return `# Miro API設定
MIRO_CLIENT_ID=your_miro_client_id
MIRO_CLIENT_SECRET=your_miro_client_secret
MIRO_ACCESS_TOKEN=your_miro_access_token
MIRO_REFRESH_TOKEN=your_miro_refresh_token

# アプリケーション設定
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# セキュリティ設定
ENCRYPTION_KEY=your_32_character_encryption_key
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# アップロード設定
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif
TEMP_DIRECTORY=/tmp
CLEANUP_INTERVAL=3600000

# セキュリティオプション
TOKEN_EXPIRATION_CHECK=true
RUNTIME_VALIDATION=true
SECRET_ROTATION_INTERVAL=2592000000

# 本番環境用（必要に応じて設定）
# SENTRY_DSN=your_sentry_dsn
# REDIS_URL=your_redis_url
# DATABASE_URL=your_database_url
`;
}

/**
 * 初期化時の設定チェック
 */
export function initializeConfig(): void {
  try {
    // 設定の基本検証
    const validation = validateConfig();
    if (!validation.isValid) {
      console.error('Configuration validation failed:', validation.errors);
      if (config.isProduction) {
        throw new Error('Invalid configuration detected in production environment');
      }
    }

    // セキュリティランタイムチェック
    performSecurityRuntimeCheck();

    console.log('✓ Configuration initialized successfully');
  } catch (error) {
    console.error('❌ Configuration initialization failed:', error);
    throw error;
  }
}

// 開発環境での自動デバッグ表示
if (config.isDevelopment && typeof window === 'undefined') {
  debugConfig();
}
