export interface User {
  email: string;
  emailVerified: boolean;
  sub: string; // Cognito user ID
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
