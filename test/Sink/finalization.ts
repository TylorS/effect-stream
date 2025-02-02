import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("ensuring - happy path", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      yield* $(
        pipe(
          Stream.make(1, 2, 3, 4, 5),
          Stream.run(pipe(Sink.drain(), Sink.ensuring(Ref.set(ref, true))))
        )
      )
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("ensuring - error", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      yield* $(
        pipe(
          Stream.fail("boom!"),
          Stream.run(pipe(Sink.drain(), Sink.ensuring(Ref.set(ref, true)))),
          Effect.ignore
        )
      )
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))
})
