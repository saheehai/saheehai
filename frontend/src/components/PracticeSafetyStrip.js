import React from 'react';
import { Phone } from 'lucide-react';

/**
 * The bottom of the Practice screens that are not the game itself: the front
 * card, the summary, and the blocked and error states.
 *
 * It used to sit under every card too. It came off the play surface on
 * 2026-09-18 because it cost about a fifth of a phone screen on every card,
 * and what was left had the question cut in half. 988 is still here before
 * anyone starts and after they stop, and PracticeCard puts it inside the
 * feedback of any card marked sensitive, which is the moment it is actually
 * likely to be wanted.
 */
function PracticeSafetyStrip() {
  return (
    <div className="practice-safety">
      <p className="practice-safety__line">
        These cards are not therapy and there is no score. The line below is answered by a
        person, any time of day.
      </p>
      <a className="footer-crisis__action practice-safety__call" href="tel:988">
        <Phone size={17} strokeWidth={2.25} aria-hidden="true" />
        <span>Call or text 988</span>
      </a>
    </div>
  );
}

export default React.memo(PracticeSafetyStrip);
