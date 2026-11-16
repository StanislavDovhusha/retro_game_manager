import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { t } from '../i18n/index.ts';
import { PathTraversalError, ValidationError } from '../utils/errors.ts';

/** Zod schemas for the parts of a request. Every part is optional. */
export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  headers?: ZodTypeAny;
}

/** Parsed values of the parts a set of schemas describes; the types come from the schemas themselves. */
export type ValidatedInput<S extends RequestSchemas> = {
  [K in keyof S]: S[K] extends ZodTypeAny ? z.output<S[K]> : never;
};

const PARTS = ['body', 'query', 'params', 'headers'] as const;
const PATH_CODE = 'PATH_OUTSIDE_ROOT';

/** Parsed input per request. A WeakMap keeps it off the (untyped) Express request object. */
const parsed = new WeakMap<object, Record<string, unknown>>();

/** Helps TypeScript keep the exact shape of the schemas object. */
export const defineInput = <S extends RequestSchemas>(schemas: S): S => schemas;

/**
 * Validates the body, query, route parameters and headers of a request against zod schemas.
 * On failure it answers 400 through the central error handler; on success the parsed (typed, stripped of
 * unknown keys) values are available to the controller through `inputOf`.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const result: Record<string, unknown> = {};
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const source: unknown = part === 'headers' ? req.headers : req[part];
      const outcome = schema.safeParse(source);
      if (!outcome.success) {
        const issues = outcome.error.issues.map((issue) => ({
          part,
          path: issue.path.join('.'),
          message: issue.message,
          custom: issue.code === 'custom',
          params: issue.code === 'custom' ? issue.params : undefined,
        }));
        const [first] = issues;
        // Our own (translated) messages are shown as they are; generic zod messages get the field name.
        const message = first ? (first.custom || !first.path ? first.message : `${first.path}: ${first.message}`) : t('Invalid request');
        const details = issues.map(({ part: where, path, message: text }) => ({ in: where, path, message: text }));
        // A path-traversal check inside a schema keeps its own error code.
        if (first?.params?.appCode === PATH_CODE) next(new PathTraversalError(message, { details }, 400));
        else next(new ValidationError(message, { details }));
        return;
      }
      result[part] = outcome.data;
    }
    parsed.set(req, result);
    next();
  };
}

/** The validated input of a request, typed by the schemas passed to `validate`. */
export function inputOf<S extends RequestSchemas>(_schemas: S, req: Request): ValidatedInput<S> {
  const value = parsed.get(req);
  if (!value) throw new Error('inputOf() was called on a request that did not pass through validate()');
  return value as ValidatedInput<S>;
}
