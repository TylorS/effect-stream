/**
 * @since 1.0.0
 */
import type * as Either from "@effect/data/Either"
import type * as Cause from "@effect/io/Cause"
import type * as Effect from "@effect/io/Effect"
import type * as Exit from "@effect/io/Exit"
import * as internal from "@effect/stream/internal/channel/singleProducerAsyncInput"

/**
 * An MVar-like abstraction for sending data to channels asynchronously which is
 * designed for one producer and multiple consumers.
 *
 * Features the following semantics:
 *   - Buffer of size 1.
 *   - When emitting, the producer waits for a consumer to pick up the value to
 *     prevent "reading ahead" too much.
 *   - Once an emitted element is read by a consumer, it is cleared from the
 *     buffer, so that at most one consumer sees every emitted element.
 *   - When sending a done or error signal, the producer does not wait for a
 *     consumer to pick up the signal. The signal stays in the buffer after
 *     being read by a consumer, so it can be propagated to multiple consumers.
 *   - Trying to publish another emit/error/done after an error/done have
 *     already been published results in an interruption.
 *
 * @since 1.0.0
 * @category models
 */
export interface SingleProducerAsyncInput<Err, Elem, Done>
  extends AsyncInputProducer<Err, Elem, Done>, AsyncInputConsumer<Err, Elem, Done>
{
  /**
   * @macro traced
   */
  close(): Effect.Effect<never, never, unknown>
  /**
   * @macro traced
   */
  take(): Effect.Effect<never, never, Exit.Exit<Either.Either<Err, Done>, Elem>>
}

/**
 * Producer-side view of `SingleProducerAsyncInput` for variance purposes.
 *
 * @since 1.0.0
 * @category models
 */
export interface AsyncInputProducer<Err, Elem, Done> {
  /**
   * @macro traced
   */
  awaitRead(): Effect.Effect<never, never, unknown>
  /**
   * @macro traced
   */
  done(value: Done): Effect.Effect<never, never, unknown>
  /**
   * @macro traced
   */
  emit(element: Elem): Effect.Effect<never, never, unknown>
  /**
   * @macro traced
   */
  error(cause: Cause.Cause<Err>): Effect.Effect<never, never, unknown>
}

/**
 * Consumer-side view of `SingleProducerAsyncInput` for variance purposes.
 *
 * @since 1.0.0
 * @category models
 */
export interface AsyncInputConsumer<Err, Elem, Done> {
  /**
   * @macro traced
   */
  takeWith<A>(
    onError: (cause: Cause.Cause<Err>) => A,
    onElement: (element: Elem) => A,
    onDone: (value: Done) => A
  ): Effect.Effect<never, never, A>
}

/**
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const make: <Err, Elem, Done>() => Effect.Effect<never, never, SingleProducerAsyncInput<Err, Elem, Done>> =
  internal.make
