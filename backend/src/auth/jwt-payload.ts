/** Shape of every signed JWT payload (web cookie + bearer + IoT bearer). */
export interface JwtPayload {
  /** User id (public.users.id). */
  sub: number;
  email: string;
  /** Active tenant id; null = super-admin acting at platform scope. */
  tenantId: number | null;
  /** Role names. */
  roles: string[];
  /** Token kind — keeps web tokens out of IoT routes and vice versa. */
  kind: 'web' | 'web-refresh' | 'iot';
}
