import * as Chunk from "@effect/data/Chunk"
import * as Duration from "@effect/data/Duration"
import * as Either from "@effect/data/Either"
import { identity, pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as TestClock from "@effect/io/internal_effect_untraced/testing/testClock"
import * as Ref from "@effect/io/Ref"
import * as GroupBy from "@effect/stream/GroupBy"
import * as Handoff from "@effect/stream/internal/stream/handoff"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import { chunkCoordination } from "@effect/stream/test/utils/coordination"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("groupBy - values", () =>
    Effect.gen(function*($) {
      const words = pipe(
        Chunk.makeBy(() => Chunk.range(0, 99))(100),
        Chunk.flatten,
        Chunk.map((n) => String(n))
      )
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.groupByKeyBuffer(identity, 8192),
        GroupBy.evaluate((key, stream) =>
          pipe(
            Stream.runCollect(stream),
            Effect.map((leftover) => [key, leftover.length] as const),
            Stream.fromEffect
          )
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        Array.from({ length: 100 }, (_, i) => i).map((n) => [String(n), 100] as const)
      )
    }))

  it.effect("groupBy - first", () =>
    Effect.gen(function*($) {
      const words = pipe(
        Chunk.makeBy(() => Chunk.range(0, 99))(1_000),
        Chunk.flatten,
        Chunk.map((n) => String(n))
      )
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.groupByKeyBuffer(identity, 1050),
        GroupBy.first(2),
        GroupBy.evaluate((key, stream) =>
          pipe(
            Stream.runCollect(stream),
            Effect.map((leftover) => [key, leftover.length] as const),
            Stream.fromEffect
          )
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [["0", 1_000], ["1", 1_000]])
    }))

  it.effect("groupBy - filter", () =>
    Effect.gen(function*($) {
      const words = Array.from({ length: 100 }, () => Array.from({ length: 100 }, (_, i) => i)).flat()
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.groupByKeyBuffer(identity, 1050),
        GroupBy.filter((n) => n <= 5),
        GroupBy.evaluate((key, stream) =>
          pipe(
            Stream.runCollect(stream),
            Effect.map((leftover) => [key, leftover.length] as const),
            Stream.fromEffect
          )
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [
        [0, 100],
        [1, 100],
        [2, 100],
        [3, 100],
        [4, 100],
        [5, 100]
      ])
    }))

  it.effect("groupBy - outer errors", () =>
    Effect.gen(function*($) {
      const words = ["abc", "test", "test", "foo"]
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.concat(Stream.fail("boom")),
        Stream.groupByKey(identity),
        GroupBy.evaluate((_, stream) => Stream.drain(stream)),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("boom"))
    }))

  it.effect("grouped - sanity check", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4, 5),
        Stream.grouped(2),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2], [3, 4], [5]]
      )
    }))

  it.effect("grouped - group size is correct", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.range(0, 100),
        Stream.grouped(10),
        Stream.map(Chunk.size),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        Array.from({ length: 10 }, () => 10)
      )
    }))

  it.effect("grouped - does not emit empty chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromIterable(Chunk.empty<number>()),
        Stream.grouped(5),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [])
    }))

  it.effect("grouped - emits elements properly when a failure occurs", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(Chunk.empty<Array<number>>()))
      const streamChunks = Stream.fromChunks(Chunk.range(1, 4), Chunk.range(5, 7), Chunk.of(8))
      const stream = pipe(
        streamChunks,
        Stream.concat(Stream.fail("Ouch")),
        Stream.grouped(3)
      )
      const either = yield* $(pipe(
        stream,
        Stream.mapEffect((chunk) => Ref.update(ref, Chunk.append(Array.from(chunk)))),
        Stream.runCollect,
        Effect.either
      ))
      const result = yield* $(Ref.get(ref))
      assert.deepStrictEqual(either, Either.left("Ouch"))
      assert.deepStrictEqual(Array.from(result), [[1, 2, 3], [4, 5, 6], [7, 8]])
    }))

  it.effect("groupedWithin - group based on time passed", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.make(1, 2),
        Chunk.make(3, 4),
        Chunk.of(5)
      ]))
      const stream = pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.flattenChunks,
        Stream.groupedWithin(10, Duration.seconds(2)),
        Stream.tap(() => coordination.proceed)
      )
      const fiber = yield* $(Effect.fork(Stream.runCollect(stream)))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(2))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(2))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(coordination.offer)
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2], [3, 4], [5]]
      )
    }))

  it.effect("groupedWithin - group based on time passed (ZIO Issue #5013)", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(pipe(
        Chunk.range(1, 29),
        Chunk.map(Chunk.of),
        chunkCoordination
      ))
      const latch = yield* $(Handoff.make<void>())
      const ref = yield* $(Ref.make(0))
      const fiber = yield* $(pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.flattenChunks,
        Stream.tap(() => coordination.proceed),
        Stream.groupedWithin(10, Duration.seconds(3)),
        Stream.tap((chunk) =>
          pipe(
            Ref.update(ref, (n) => n + chunk.length),
            Effect.zipRight(pipe(latch, Handoff.offer<void>(void 0)))
          )
        ),
        Stream.run(Sink.take(5)),
        Effect.fork
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      const result1 = yield* $(pipe(
        Handoff.take(latch),
        Effect.zipRight(Ref.get(ref))
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      const result2 = yield* $(pipe(
        Handoff.take(latch),
        Effect.zipRight(Ref.get(ref))
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
        Effect.zipRight(coordination.awaitNext)
      ))
      const result3 = yield* $(pipe(
        Handoff.take(latch),
        Effect.zipRight(Ref.get(ref))
      ))
      // This part is to make sure schedule clock is being restarted when the
      // specified amount of elements has been reached.
      yield* $(pipe(
        TestClock.adjust(Duration.seconds(2)),
        Effect.zipRight(
          pipe(
            coordination.offer,
            Effect.zipRight(coordination.awaitNext),
            Effect.repeatN(9)
          )
        )
      ))
      const result4 = yield* $(pipe(
        Handoff.take(latch),
        Effect.zipRight(Ref.get(ref))
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(coordination.awaitNext),
        Effect.zipRight(TestClock.adjust(Duration.seconds(2))),
        Effect.zipRight(
          pipe(
            coordination.offer,
            Effect.zipRight(coordination.awaitNext),
            Effect.repeatN(8)
          )
        )
      ))
      const result5 = yield* $(pipe(
        Handoff.take(latch),
        Effect.zipRight(Ref.get(ref))
      ))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
          [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
          [20, 21, 22, 23, 24, 25, 26, 27, 28, 29]
        ]
      )
      assert.strictEqual(result1, 3)
      assert.strictEqual(result2, 6)
      assert.strictEqual(result3, 9)
      assert.strictEqual(result4, 19)
      assert.strictEqual(result5, 29)
    }))

  it.effect("groupedWithin - group immediately when chunk size is reached", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4),
        Stream.groupedWithin(2, Duration.seconds(10)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2], [3, 4]]
      )
    }))
})
