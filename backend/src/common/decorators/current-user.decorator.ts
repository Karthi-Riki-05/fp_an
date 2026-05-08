import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  /** Active tenant id from the JWT. null for super-admins acting at platform scope. */
  tenantId: number | null;
  /** Role names assigned to the user. */
  roles: string[];
  /** Whether the user holds a role with `all = true` (super-admin shortcut). */
  isAdmin: boolean;
}

/** Extracts the AuthUser from the request, populated by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    return ctx.switchToHttp().getRequest().user;
  },
);
