// Base error type for composables - will be extended using Data.TaggedError in implementations
export interface BaseComposableError {
  readonly _tag: string;
  message: string;
  context?: string;
  cause?: unknown;
}
