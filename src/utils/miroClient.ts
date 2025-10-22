import 'server-only';
import { config } from './config';
import { ErrorHandler, logError } from './errorHandler';
import { UserFriendlyError } from '@/types';

// Miro API レスポンス型定義
export interface MiroBoardInfo {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  picture?: {
    imageUrl?: string;
  };
}

export interface MiroItemBase {
  id: string;
  type: string;
  position: { x: number; y: number };
  createdAt: string;
  modifiedAt: string;
  parentGroup?: {
    id: string;
  };
}

export interface MiroImageItem extends MiroItemBase {
  type: 'image';
  url: string;
  geometry: { width: number; height: number };
}

export interface MiroStickyNote extends MiroItemBase {
  type: 'sticky_note';
  data: {
    content: string;
    shape?: 'square' | 'rectangle';
  };
  style: {
    fillColor: string;
    textAlign: 'left' | 'center' | 'right';
  };
}

export interface MiroGroup extends MiroItemBase {
  type: 'group';
  childrenIds: string[];
}

export type MiroItem = MiroImageItem | MiroStickyNote | MiroGroup;

/**
 * Miroクライアントの抽象インターフェース（テスト容易化/DI用）
 */
export interface IMiroClient {
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
  getBoards(limit?: number): Promise<MiroBoardInfo[]>;
  getBoard(boardId: string): Promise<MiroBoardInfo>;
  uploadImage(
    boardId: string,
    imageFile: File,
    options?: {
      position?: { x: number; y: number };
      geometry?: { width: number; height: number };
    }
  ): Promise<MiroImageItem>;
  createStickyNote(
    boardId: string,
    content: string,
    position: { x: number; y: number },
    style?: { fillColor?: string; textAlign?: 'left' | 'center' | 'right' },
    options?: { geometry?: { width: number; height: number } }
  ): Promise<MiroStickyNote>;
  patchItem(
    boardId: string,
    itemId: string,
    body: {
      position?: { x: number; y: number; origin?: 'center' };
      parent?: { id: string };
      geometry?: { width?: number; height?: number };
    }
  ): Promise<void>;
  createGroup(boardId: string, payload: { data: { items: string[] } }): Promise<MiroGroup>;
  searchItems(boardId: string, query?: string, type?: string): Promise<MiroItem[]>;
  refreshAccessToken(refreshToken?: string): Promise<string>;
}

/**
 * Miro APIクライアント
 */
export class MiroApiClient implements IMiroClient {
  private accessToken: string;
  private baseUrl = 'https://api.miro.com/v2';

  static readonly DEFAULT_IMAGE_SIZE = 400;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || config.miro.accessToken;
  }

  /**
   * 共通のHTTPリクエスト処理（パブリック版）
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.makeRequest<T>(endpoint, options);
  }

  /**
   * 共通のHTTPリクエスト処理（内部用）
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = {
          response: {
            status: response.status,
            data: errorData,
          },
          message: errorData.message || response.statusText,
        };
        
        // エラーの詳細をログ出力（可観測性向上）
        console.error('Miro API Error:', {
          url,
          method: requestOptions.method || 'GET',
          status: response.status,
          errorData: JSON.stringify(errorData, null, 2)
        });
        
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error: unknown) {
      logError(error instanceof Error ? error : new Error(String(error)), `MiroApiClient.request ${endpoint}`);
      throw ErrorHandler.handleMiroApiError(error);
    }
  }

  /**
   * ボード一覧を取得
   */
  async getBoards(limit: number = 20): Promise<MiroBoardInfo[]> {
    try {
      const response = await this.makeRequest<{ data: MiroBoardInfo[] }>(`/boards?limit=${limit}`);
      return response.data || [];
    } catch (error) {
      logError(error as Error, 'MiroApiClient.getBoards');
      throw error;
    }
  }

  /**
   * 特定のボード情報を取得
   */
  async getBoard(boardId: string): Promise<MiroBoardInfo> {
    try {
      return await this.makeRequest<MiroBoardInfo>(`/boards/${boardId}`);
    } catch (error) {
      logError(error as Error, 'MiroApiClient.getBoard');
      throw error;
    }
  }

  /**
   * ボードに画像をアップロード
   */
  async uploadImage(
    boardId: string,
    imageFile: File,
    options: {
      position?: { x: number; y: number };
      geometry?: { width: number; height: number };
    } = {}
  ): Promise<MiroImageItem> {
    try {
      const position = options.position ?? { x: 0, y: 0 };
      const geometry = options.geometry ?? {
        width: MiroApiClient.DEFAULT_IMAGE_SIZE,
        height: MiroApiClient.DEFAULT_IMAGE_SIZE,
      };

      const formData = new FormData();
      formData.append('resource', imageFile);
      formData.append('position.x', String(position.x));
      formData.append('position.y', String(position.y));
      formData.append('geometry.width', String(geometry.width));
      formData.append('geometry.height', String(geometry.height));

      const response = await fetch(`${this.baseUrl}/boards/${boardId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          response: {
            status: response.status,
            data: errorData,
          },
        };
      }

      return await response.json();
    } catch (error) {
      logError(error as Error, 'MiroApiClient.uploadImage');
      throw ErrorHandler.handleMiroApiError(error);
    }
  }

  /**
   * 付箋を作成
   */
  async createStickyNote(
    boardId: string,
    content: string,
    position: { x: number; y: number },
    style: {
      fillColor?: string;
      textAlign?: 'left' | 'center' | 'right';
    } = {},
    options: { geometry?: { width?: number; height?: number } } = {}
  ): Promise<MiroStickyNote> {
    try {
      // コンテンツを簡易HTMLに変換（改行を<br/>に）
      const contentHtml = content.replace(/\n/g, '<br/>');
      
      // 色名を正規化
      const normalizedColor = this.normalizeStickyFillColor(style.fillColor);

      const data = {
        data: {
          content: contentHtml,
          shape: 'square' as const,
        },
        style: {
          fillColor: normalizedColor,
          textAlign: style.textAlign || 'left',
        },
        position: {
          x: position.x,
          y: position.y,
          origin: 'center' as const,
        },
        ...(options.geometry
          ? {
              geometry: {
                ...(typeof options.geometry.width === 'number' ? { width: options.geometry.width } : {}),
                ...(typeof options.geometry.height === 'number' ? { height: options.geometry.height } : {}),
              },
            }
          : {}),
      };

      // デバッグ用ログ
      console.log('Creating sticky note with data:', JSON.stringify(data, null, 2));

      return await this.makeRequest<MiroStickyNote>(`/boards/${boardId}/sticky_notes`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      logError(error as Error, 'MiroApiClient.createStickyNote');
      
      // エラーの詳細情報をログ出力
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response: { status: number; data: unknown } }).response;
        console.error('Sticky note creation failed:', {
          status: response.status,
          data: JSON.stringify(response.data, null, 2),
          requestData: { boardId, content, position, style }
        });
      }
      
      throw error;
    }
  }

  /**
   * Miro API v2で許可されている付箋の色名
   */
  private readonly ALLOWED_STICKY_COLORS: readonly string[] = [
    'gray', 'light_yellow', 'yellow', 'orange', 'light_green', 'green', 'dark_green',
    'cyan', 'light_pink', 'pink', 'violet', 'red', 'light_blue', 'blue', 'dark_blue', 'black'
  ];

  /**
   * 色名のエイリアス（互換性のため）
   */
  private readonly COLOR_ALIASES: Record<string, string> = {
    'purple': 'violet',
    'light_purple': 'violet',
    'light_orange': 'orange',
  };

  /**
   * 付箋の色名を正規化（Miro API v2準拠）
   */
  private normalizeStickyFillColor(input?: string): string {
    if (!input) return 'light_yellow';
    
    const normalized = input.trim().toLowerCase();
    
    // 正規の色名ならそのまま使用
    if (this.ALLOWED_STICKY_COLORS.includes(normalized)) {
      return normalized;
    }
    
    // エイリアスがあれば変換
    if (this.COLOR_ALIASES[normalized]) {
      return this.COLOR_ALIASES[normalized];
    }
    
    // 不明な色はデフォルトにフォールバック
    console.warn(`Unknown sticky note color "${input}", falling back to light_yellow`);
    return 'light_yellow';
  }


  /**
   * アイテムの位置・親フレーム更新（Miro API v2準拠）
   */
  async patchItem(
    boardId: string,
    itemId: string,
    body: {
      position?: { x: number; y: number; origin?: 'center' };
      parent?: { id: string };
      geometry?: { width?: number; height?: number };
    }
  ): Promise<void> {
    try {
      await this.makeRequest(`/boards/${boardId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } catch (error) {
      logError(error as Error, 'MiroApiClient.patchItem');
      throw error;
    }
  }

  /**
   * アイテムをグループ化（Miro API v2準拠）
   */
  async createGroup(
    boardId: string,
    payload: { data: { items: string[] } }
  ): Promise<MiroGroup> {
    try {
      // デバッグ用ログ（送信直前）
      console.log('[MiroClient] Creating group with payload:', JSON.stringify(payload, null, 2));

      return await this.makeRequest<MiroGroup>(`/boards/${boardId}/groups`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      logError(error as Error, 'MiroApiClient.createGroup');
      
      // エラーの詳細情報をJSON形式でログ出力
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response: { status: number; data: unknown } }).response;
        console.error('Group creation failed:', {
          status: response.status,
          data: JSON.stringify(response.data, null, 2),
          requestPayload: payload
        });
      }
      
      throw error;
    }
  }

  /**
   * ボード内のアイテムを検索
   */
  async searchItems(
    boardId: string,
    query?: string,
    type?: string
  ): Promise<MiroItem[]> {
    try {
      let endpoint = `/boards/${boardId}/items?limit=50`;
      
      if (type) {
        endpoint += `&type=${type}`;
      }

      const response = await this.makeRequest<{ data: MiroItem[] }>(endpoint);
      return response.data || [];
    } catch (error) {
      logError(error as Error, 'MiroApiClient.searchItems');
      throw error;
    }
  }

  /**
   * アクセストークンの更新
   */
  async refreshAccessToken(refreshToken?: string): Promise<string> {
    const token = refreshToken || config.miro.refreshToken;
    
    if (!token) {
      throw new UserFriendlyError('リフレッシュトークンが設定されていません。');
    }

    try {
      const response = await fetch('https://api.miro.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.miro.clientId,
          client_secret: config.miro.clientSecret,
          refresh_token: token,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh access token');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      
      return data.access_token;
    } catch (error) {
      logError(error as Error, 'MiroApiClient.refreshAccessToken');
      throw new UserFriendlyError('認証の更新に失敗しました。管理者にお問い合わせください。');
    }
  }
}

/**
 * デフォルトのMiroクライアントインスタンス
 */
export const miroClient = new MiroApiClient();
