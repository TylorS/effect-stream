import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("filterInput", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(Sink.collectAll<number>(), Sink.filterInput((n) => n % 2 === 0)))
        )
      )
      assert.deepStrictEqual(Array.from(result), [2, 4, 6, 8])
    }))

  it.effect("filterInputEffect - happy path", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(
            Sink.collectAll<number>(),
            Sink.filterInputEffect((n) => Effect.succeed(n % 2 === 0))
          ))
        )
      )
      assert.deepStrictEqual(Array.from(result), [2, 4, 6, 8])
    }))

  it.effect("filterInputEffect - error", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(
            Sink.collectAll<number>(),
            Sink.filterInputEffect(() => Effect.fail("fail"))
          )),
          Effect.flip
        )
      )
      assert.strictEqual(result, "fail")
    }))
})
