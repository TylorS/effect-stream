import * as Chunk from "@effect/data/Chunk"
import * as Context from "@effect/data/Context"
import * as Either from "@effect/data/Either"
import * as Option from "@effect/data/Option"
import { unify } from "@effect/data/Unify"
import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import { nextInt } from "@effect/io/Random"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream.Foreign", () => {
  it.effect("Tag", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        tag,
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, [10])
    }))

  it.effect("Unify", () =>
    Effect.gen(function*($) {
      const unifiedEffect = unify((yield* $(nextInt())) > 1 ? Effect.succeed(0) : Effect.fail(1))
      const unifiedExit = unify((yield* $(nextInt())) > 1 ? Exit.succeed(0) : Exit.fail(1))
      const unifiedEither = unify((yield* $(nextInt())) > 1 ? Either.right(0) : Either.left(1))
      const unifiedOption = unify((yield* $(nextInt())) > 1 ? Option.some(0) : Option.none())
      assert.deepEqual(Chunk.toReadonlyArray(yield* $(Stream.runCollect(unifiedEffect))), [0])
      assert.deepEqual(Chunk.toReadonlyArray(yield* $(Stream.runCollect(unifiedExit))), [0])
      assert.deepEqual(Chunk.toReadonlyArray(yield* $(Stream.runCollect(unifiedEither))), [0])
      assert.deepEqual(Chunk.toReadonlyArray(yield* $(Stream.runCollect(unifiedOption))), [0])
    }))

  it.effect("Either.right", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()

      const result = yield* $(
        Either.right(10),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, [10])
    }))

  it.effect("Either.left", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Either.left(10),
        Stream.runCollect,
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.left(10))
    }))

  it.effect("Option.some", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Option.some(10),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, [10])
    }))

  it.effect("Option.none", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Option.none(),
        Stream.runCollect,
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.left(Cause.NoSuchElementException()))
    }))

  it.effect("Effect.fail", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Effect.fail("ok"),
        Stream.runCollect,
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.left("ok"))
    }))

  it.effect("Effect.succeed", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Effect.succeed("ok"),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.right(["ok"]))
    }))
})
