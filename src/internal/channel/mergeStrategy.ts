import { dual } from "@effect/data/Function"
import type * as MergeStrategy from "@effect/stream/Channel/MergeStrategy"
import * as OpCodes from "@effect/stream/internal/opCodes/mergeStrategy"

/** @internal */
const MergeStrategySymbolKey = "@effect/stream/Channel/MergeStrategy"

/** @internal */
export const MergeStrategyTypeId: MergeStrategy.MergeStrategyTypeId = Symbol.for(
  MergeStrategySymbolKey
) as MergeStrategy.MergeStrategyTypeId

/** @internal */
const proto = {
  [MergeStrategyTypeId]: MergeStrategyTypeId
}

/** @internal */
export const BackPressure = (_: void): MergeStrategy.MergeStrategy => {
  const op = Object.create(proto)
  op._tag = OpCodes.OP_BACK_PRESSURE
  return op
}

/** @internal */
export const BufferSliding = (_: void): MergeStrategy.MergeStrategy => {
  const op = Object.create(proto)
  op._tag = OpCodes.OP_BUFFER_SLIDING
  return op
}

/** @internal */
export const isMergeStrategy = (u: unknown): u is MergeStrategy.MergeStrategy =>
  typeof u === "object" && u != null && MergeStrategyTypeId in u

/** @internal */
export const isBackPressure = (self: MergeStrategy.MergeStrategy): self is MergeStrategy.BackPressure =>
  self._tag === OpCodes.OP_BACK_PRESSURE

/** @internal */
export const isBufferSliding = (self: MergeStrategy.MergeStrategy): self is MergeStrategy.BufferSliding =>
  self._tag === OpCodes.OP_BUFFER_SLIDING

/** @internal */
export const match = dual<
  <A>(onBackPressure: () => A, onBufferSliding: () => A) => (self: MergeStrategy.MergeStrategy) => A,
  <A>(
    self: MergeStrategy.MergeStrategy,
    onBackPressure: () => A,
    onBufferSliding: () => A
  ) => A
>(3, <A>(
  self: MergeStrategy.MergeStrategy,
  onBackPressure: () => A,
  onBufferSliding: () => A
): A => {
  switch (self._tag) {
    case OpCodes.OP_BACK_PRESSURE: {
      return onBackPressure()
    }
    case OpCodes.OP_BUFFER_SLIDING: {
      return onBufferSliding()
    }
  }
})
