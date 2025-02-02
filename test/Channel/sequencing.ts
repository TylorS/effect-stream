import * as Chunk from "@effect/data/Chunk"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Channel from "@effect/stream/Channel"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Channel", () => {
  it.effect("flatMap - simple", () =>
    Effect.gen(function*($) {
      const channel = pipe(
        Channel.succeed(1),
        Channel.flatMap((x) =>
          pipe(
            Channel.succeed(x * 2),
            Channel.flatMap((y) =>
              pipe(
                Channel.succeed(x + y),
                Channel.map((z) => x + y + z)
              )
            )
          )
        )
      )
      const [chunk, value] = yield* $(Channel.runCollect(channel))
      assert.isTrue(Chunk.isEmpty(chunk))
      assert.strictEqual(value, 6)
    }))

  it.effect("flatMap - structure confusion", () =>
    Effect.gen(function*($) {
      const channel = pipe(
        Channel.write(Chunk.make(1, 2)),
        Channel.concatMap(Channel.writeAll),
        Channel.zipRight(Channel.fail("hello"))
      )
      const result = yield* $(Effect.exit(Channel.runDrain(channel)))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("hello"))
    }))
})
