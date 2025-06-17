import {
  type UseFormValidation,
  type UseFormValidationOptions,
  type FormState,
  type FormErrors
} from '$lib/types/ui';
import { Schema as S } from 'effect';
import * as Effect from 'effect/Effect';
import * as E from 'effect/Either';
import * as ParseResult from 'effect/ParseResult';

export function useFormValidation<T extends object>(
  options: UseFormValidationOptions<T>
): UseFormValidation<T> {
  const initialState: FormState<T> = {
    values: { ...options.initialValues },
    errors: {},
    touched: {}
  };

  let state = $state<FormState<T>>({ ...initialState });
  const equivalence = S.equivalence(options.schema);

  const isDirty = $derived(!equivalence(state.values, options.initialValues));
  const isValid = $derived(Object.keys(state.errors).length === 0 && isDirty);

  function updateField<K extends keyof T>(field: K, value: T[K]) {
    state.values[field] = value;
    state.touched[field] = true;
    validateField(field);
  }

  function setTouched(field: keyof T, isTouched: boolean) {
    state.touched[field] = isTouched;
    if (isTouched) {
      validateField(field);
    }
  }

  async function validateField(field: keyof T): Promise<boolean> {
    const effect = S.decode(options.schema)(state.values, {
      onExcessProperty: 'ignore',
      errors: 'all'
    });
    const result = await Effect.runPromise(Effect.either(effect));

    // Optimistically clear the error for the current field
    delete state.errors[field];

    if (E.isLeft(result)) {
      const error = result.left;
      // @ts-ignore - Linter struggles with this type, but it is correct at runtime
      const fieldError = error.errors.find((e) => e.path[0] === field);

      if (fieldError) {
        // @ts-ignore
        state.errors[field] = fieldError.message;
        return false;
      }
    }

    return true;
  }

  function validateForm() {
    return S.decode(options.schema)(state.values, { onExcessProperty: 'ignore' }).pipe(
      Effect.mapError((error) => {
        if (error instanceof ParseResult.ParseError) {
          const newErrors: FormErrors<T> = {};
          // @ts-ignore - Linter incorrectly flags that 'errors' does not exist on ParseError
          for (const issue of error.errors) {
            const key = issue.path[0] as keyof T;
            if (key) {
              // @ts-ignore - Linter incorrectly flags that 'message' does not exist on 'issue'
              newErrors[key] = issue.message;
            }
          }
          state.errors = newErrors;
          return { _tag: 'ValidationError', errors: newErrors } as const;
        }
        return { _tag: 'UnknownError', error } as const;
      })
    );
  }

  function reset() {
    state.values = { ...options.initialValues };
    state.errors = {};
    state.touched = {};
  }

  return {
    get values() {
      return state.values;
    },
    get errors() {
      return state.errors;
    },
    get touched() {
      return state.touched;
    },
    get isDirty() {
      return isDirty;
    },
    get isValid() {
      return isValid;
    },
    updateField,
    setTouched,
    validateField,
    validateForm,
    reset
  };
}
