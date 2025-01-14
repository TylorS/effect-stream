import * as Chunk from "@effect/data/Chunk"
import * as Either from "@effect/data/Either"
import { constTrue, pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("transduce - simple example", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.make("1", "2", ",", "3", "4"),
          Stream.transduce(
            pipe(
              Sink.collectAllWhile((char: string) => Number.isInteger(Number.parseInt(char))),
              Sink.zipLeft(Sink.collectAllWhile((char: string) => !Number.isInteger(Number.parseInt(char))))
            )
          ),
          Stream.map(Chunk.join("")),
          Stream.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(result), ["12", "34"])
    }))

  it.effect("transduce - no remainder", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.make(1, 2, 3, 4),
          Stream.transduce(Sink.fold(100, (n) => n % 2 === 0, (acc, n) => acc + n)),
          Stream.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(result), [101, 105, 104])
    }))

  it.effect("transduce - with a sink that always signals more", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.make(1, 2, 3),
          Stream.transduce(Sink.fold(0, constTrue, (acc, n) => acc + n)),
          Stream.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(result), [6])
    }))

  it.effect("transduce - propagates scope error", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.make(1, 2, 3),
          Stream.transduce(Sink.fail("Woops")),
          Stream.runCollect,
          Effect.either
        )
      )
      assert.deepStrictEqual(result, Either.left("Woops"))
    }))
})
