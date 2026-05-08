import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  /**
   * URL-safe slug used to derive the per-tenant Postgres schema name.
   * Lowercase a-z 0-9 and underscore; must start with a letter.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'slug must be lowercase a-z/0-9/_, starting with a letter',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
