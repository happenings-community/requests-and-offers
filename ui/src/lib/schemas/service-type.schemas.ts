import { Schema as S } from 'effect';

export const ServiceTypeSchema = S.Struct({
  name: S.String.pipe(
    S.minLength(2, { message: () => 'Name must be at least 2 characters' }),
    S.maxLength(50, { message: () => 'Name must be less than 50 characters' })
  ),
  description: S.String.pipe(
    S.minLength(10, { message: () => 'Description must be at least 10 characters' }),
    S.maxLength(500, { message: () => 'Description must be less than 500 characters' })
  ),
  tags: S.Array(S.String).pipe(
    S.minItems(1, { message: () => 'At least one tag is required' }),
    S.maxItems(10, { message: () => 'You can add a maximum of 10 tags' })
  )
});

export type ServiceTypeSchema = S.Schema.Type<typeof ServiceTypeSchema>;
