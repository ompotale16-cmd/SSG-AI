
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  joinedAt: number;
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: Role;
  parts: MessagePart[];
  timestamp: number;
  isImageGeneration?: boolean;
  groundingSources?: GroundingSource[];
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}
