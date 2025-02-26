export interface ProviderUser {
  id: string;
  email: string;
  name: string;
  passwordEnabled: boolean;
}

export interface AuthProvider<Name extends string = string> {
  name: Name;
  allowPassword: boolean;

  getProviderUser(providerUserId: string): Promise<ProviderUser | null>;

  verifyToken(token: string): Promise<string | null>;
  verifyPassword(providerUserId: string, password: string): Promise<boolean>;

  updatePassword(providerUserId: string, password: string): Promise<void>;
}

export type AuthProviderRegistry = Record<string, AuthProvider>;
