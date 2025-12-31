// https://github.com/sinclairzx81/typebox/blob/main/example/standard/standard.ts

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Type } from "typebox";
import { Validator } from "typebox/compile";
import type { TLocalizedValidationError } from "typebox/error";
import Guard from "typebox/guard";
import { Arguments } from "typebox/system";

interface StandardTypedV1<Input = unknown, Output = Input> {
  /** The Standard properties. */
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}

namespace StandardTypedV1 {
  /** The Standard Typed properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The Standard Typed types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Infers the input type of a Standard Typed. */
  export type InferInput<Schema extends StandardTypedV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];

  /** Infers the output type of a Standard Typed. */
  export type InferOutput<Schema extends StandardTypedV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}

function PathSegments(pointer: string): string[] {
  if (Guard.IsEqual(pointer.length, 0)) return [];
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function Issue(error: TLocalizedValidationError): StandardSchemaV1.Issue {
  const path = PathSegments(error.instancePath);
  return { path, message: error.message };
}

class StandardSchemaProps<Value>
  implements StandardSchemaV1.Props<Value, Value>
{
  public readonly vendor = "typebox";
  public readonly version = 1;
  public readonly validator: Validator;
  public types?: StandardTypedV1.Types<Value, Value> | undefined;

  constructor(context: Type.TProperties, type: Type.TSchema) {
    this.validator = new Validator(context, type);
  }

  public validate(
    value: unknown,
  ): StandardSchemaV1.Result<Value> | Promise<StandardSchemaV1.Result<Value>> {
    if (this.validator.Check(value)) {
      return { value } as never;
    }

    const errors = this.validator.Errors(value);
    const issues = errors.map((error) => Issue(error));
    return { issues };
  }
}

class StandardSchema<
  Context extends Type.TProperties,
  Type extends Type.TSchema,
  Value = Type.Static<Type, Context>,
> implements StandardSchemaV1<Value>
{
  "~standard": StandardSchemaV1.Props<Value, Value>;

  constructor(context: Context, type: Type) {
    this["~standard"] = new StandardSchemaProps(context, type);
  }
}

export function typeboxToStandardSchema<
  const Type extends Type.TSchema,
  Result = StandardSchema<{}, Type>,
>(type: Type): Result;

export function typeboxToStandardSchema<
  Context extends Type.TProperties,
  const Type extends Type.TSchema,
  Result = StandardSchema<Context, Type>,
>(context: Context, type: Type): Result;

export function typeboxToStandardSchema(...args: unknown[]): unknown {
  const [context, type] = Arguments.Match<[Type.TProperties, Type.TSchema]>(
    args,
    {
      2: (context, type) => [context, type],
      1: (type) => [{}, type],
    },
  );
  return new StandardSchema(context, type);
}
