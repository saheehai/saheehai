import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One input model for Practice, across a thumb, a trackpad, a mouse and a
 * keyboard.
 *
 *   finger up   / S / ArrowDown  / wheel down   next card
 *   finger down / W / ArrowUp    / wheel up     previous card
 *   drag left   / A / ArrowLeft                 pick the left option
 *   drag right  / D / ArrowRight                pick the right option
 *
 * Moving the finger down to reach the card above is the feed gesture people
 * already have in their hands, and it is the only reading that agrees with
 * "scroll up goes back".
 *
 * Two decisions worth keeping:
 *
 * A gesture that is not clearly horizontal or vertical does nothing at all.
 * Between the two 30 degree cones are four bands where the card follows the
 * finger and then snaps back on release. An ignored swipe costs one repeat.
 * An accidental answer on a card about someone's coping costs more.
 *
 * Answering is harder to trigger than navigating, on purpose: further to
 * travel and faster to flick.
 */

const AXIS_LOCK_PX = 10;
const CONE_DEGREES = 30;

const ANSWER = { distance: 88, velocity: 0.55, floor: 32 };
const NAVIGATE = { distance: 72, velocity: 0.5, floor: 28 };

// One trackpad flick fires dozens of events with a decaying delta. Fire once
// when they add up, then wait for the momentum to actually die.
const WHEEL_FIRE = 120;
const WHEEL_IDLE_MS = 350;
const WHEEL_FLOOR_MS = 220;
const WHEEL_REVERSAL = 8;

const KEY_REPEAT_MS = 180;

const IDLE = { dx: 0, dy: 0, axis: null, aiming: null, committing: false };

const rubber = (value, limit, give) =>
  Math.abs(value) <= limit ? value : Math.sign(value) * (limit + (Math.abs(value) - limit) * give);

export function useCardGesture({
  onAnswer,
  onNext,
  onPrevious,
  canAnswer = true,
  enabled = true,
  reducedMotion = false,
} = {}) {
  const [drag, setDrag] = useState(IDLE);
  const pointer = useRef(null);
  const wheel = useRef({ acc: 0, locked: false, firedAt: 0, direction: 0, timer: null });
  const keyAt = useRef(0);

  // Handlers change every render; keep them in a ref so the wheel and key
  // listeners can be attached once and still call the current ones.
  const actions = useRef({});
  actions.current = { onAnswer, onNext, onPrevious, canAnswer, enabled };

  const reset = useCallback(() => setDrag(IDLE), []);

  const navigate = useCallback((direction) => {
    const { onNext: next, onPrevious: previous } = actions.current;
    if (direction > 0) next && next();
    else previous && previous();
  }, []);

  // --- pointer: touch and mouse drag, identical behaviour ------------------

  const onPointerDown = useCallback(
    (event) => {
      if (!actions.current.enabled) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // Let a real control have its own press.
      if (event.target.closest('button, a, [data-no-drag]')) return;
      pointer.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        at: event.timeStamp,
        lastAt: event.timeStamp,
        axis: null,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    []
  );

  const onPointerMove = useCallback(
    (event) => {
      const start = pointer.current;
      if (!start || start.id !== event.pointerId) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start.lastX = event.clientX;
      start.lastY = event.clientY;
      start.lastAt = event.timeStamp;

      if (!start.axis) {
        if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
        // Angle from the horizontal, 0 to 90. Inside the cone either way and
        // the axis locks for the rest of the gesture; between the cones it
        // stays unresolved and the release will do nothing.
        const angle = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
        if (angle <= CONE_DEGREES) start.axis = 'x';
        else if (angle >= 90 - CONE_DEGREES) start.axis = 'y';
        else start.axis = 'none';
      }

      if (start.axis === 'x') {
        const offset = reducedMotion
          ? Math.max(-140, Math.min(140, dx))
          : rubber(dx, 140, 0.35);
        const aiming = Math.abs(dx) >= AXIS_LOCK_PX ? (dx < 0 ? 'left' : 'right') : null;
        setDrag({
          dx: Math.round(offset),
          dy: 0,
          axis: 'x',
          aiming: actions.current.canAnswer ? aiming : null,
          committing: actions.current.canAnswer && Math.abs(dx) >= ANSWER.distance,
        });
      } else if (start.axis === 'y') {
        const offset = reducedMotion ? Math.max(-80, Math.min(80, dy)) : rubber(dy, 40, 0.5);
        setDrag({ dx: 0, dy: Math.round(offset), axis: 'y', aiming: null, committing: false });
      } else {
        setDrag({ dx: Math.round(dx), dy: Math.round(dy), axis: 'none', aiming: null, committing: false });
      }
    },
    [reducedMotion]
  );

  const onPointerUp = useCallback(
    (event) => {
      const start = pointer.current;
      if (!start || start.id !== event.pointerId) return;
      pointer.current = null;
      reset();

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const elapsed = Math.max(1, start.lastAt - start.at);

      if (start.axis === 'x' && actions.current.canAnswer) {
        const speed = Math.abs(dx) / elapsed;
        const far = Math.abs(dx) >= ANSWER.distance;
        const flick = speed >= ANSWER.velocity && Math.abs(dx) >= ANSWER.floor;
        if (far || flick) actions.current.onAnswer && actions.current.onAnswer(dx < 0 ? 'left' : 'right');
      } else if (start.axis === 'y') {
        const speed = Math.abs(dy) / elapsed;
        const far = Math.abs(dy) >= NAVIGATE.distance;
        const flick = speed >= NAVIGATE.velocity && Math.abs(dy) >= NAVIGATE.floor;
        // Finger down reaches the card above, so a positive dy goes back.
        if (far || flick) navigate(dy < 0 ? 1 : -1);
      }
    },
    [navigate, reset]
  );

  const onPointerCancel = useCallback(() => {
    pointer.current = null;
    reset();
  }, [reset]);

  // --- wheel and trackpad --------------------------------------------------

  const attachWheel = useCallback(
    (node) => {
      if (!node) return undefined;

      const unlockLater = () => {
        clearTimeout(wheel.current.timer);
        wheel.current.timer = setTimeout(() => {
          wheel.current.locked = false;
          wheel.current.acc = 0;
        }, WHEEL_IDLE_MS);
      };

      const onWheel = (event) => {
        if (!actions.current.enabled) return;

        // A scrollable region inside the card keeps its own scrolling, as
        // long as it still has somewhere to go in that direction.
        const scroller = event.target.closest && event.target.closest('[data-scrollable]');
        if (scroller) {
          const room =
            event.deltaY > 0
              ? scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 1
              : scroller.scrollTop > 1;
          if (room) return;
        }
        event.preventDefault();

        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1;
        const delta = event.deltaY * scale;
        const state = wheel.current;

        if (state.locked) {
          // A deliberate flick the other way beats the lock. Decaying
          // momentum in the same direction does not.
          const reversed = Math.sign(delta) === -state.direction && Math.abs(delta) >= WHEEL_REVERSAL;
          if (!reversed) return unlockLater();
          state.locked = false;
          state.acc = 0;
        }

        state.acc += delta;
        if (Math.abs(state.acc) < WHEEL_FIRE) return;
        if (event.timeStamp - state.firedAt < WHEEL_FLOOR_MS) return;

        state.direction = Math.sign(state.acc);
        state.firedAt = event.timeStamp;
        state.locked = true;
        state.acc = 0;
        navigate(state.direction);
        unlockLater();
      };

      node.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        node.removeEventListener('wheel', onWheel);
        clearTimeout(wheel.current.timer);
      };
    },
    [navigate]
  );

  // --- keyboard ------------------------------------------------------------

  const onKeyDown = useCallback(
    (event) => {
      if (!actions.current.enabled) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const answer = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }[
        key.toLowerCase()
      ];
      const move = { arrowup: -1, w: -1, arrowdown: 1, s: 1 }[key.toLowerCase()];

      if (answer) {
        // A held key must never answer twice.
        if (event.repeat) return event.preventDefault();
        if (!actions.current.canAnswer) return;
        event.preventDefault();
        actions.current.onAnswer && actions.current.onAnswer(answer);
        return;
      }
      if (move) {
        event.preventDefault();
        if (event.timeStamp - keyAt.current < KEY_REPEAT_MS) return;
        keyAt.current = event.timeStamp;
        navigate(move);
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  const bind = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    onLostPointerCapture: onPointerCancel,
  };

  return { bind, drag, attachWheel };
}

export default useCardGesture;
